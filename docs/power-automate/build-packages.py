#!/usr/bin/env python3
"""
Build importable Power Automate Legacy Packages (.zip) from the flow
definitions checked in next door.

Each output zip has the layout Power Automate's
"+ Import → Import Package (Legacy)" expects:

    <package>.zip
    ├── manifest.json
    └── Microsoft.Flow/
        ├── flows/
        │   └── manifest.json
        └── flows/
            └── <flowGuid>/
                ├── apisMap.json
                ├── connectionsMap.json
                └── definition.json

Run from the repo root:
    python3 v2/docs/power-automate/build-packages.py

Output:
    docs/power-automate/packages/wow-outbound-mailer.zip
    docs/power-automate/packages/wow-inbound-listener.zip
    docs/power-automate/packages/wow-outbound-mailer-hmac.zip
    docs/power-automate/packages/wow-inbound-listener-hmac.zip
    docs/power-automate/packages/wow-approval-batch.zip
"""

from __future__ import annotations
import json
import os
import sys
import uuid
import zipfile
from datetime import datetime, timezone
from pathlib import Path

REPO_DOCS = Path(__file__).resolve().parent
FLOWS_DIR = REPO_DOCS / "flows"
PACKAGES_DIR = REPO_DOCS / "packages"


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.0000000Z")


def add_authentication_parameter(actions: dict) -> None:
    """
    Walk the actions tree and add `authentication: @parameters('$authentication')`
    to every OpenApiConnection / OpenApiConnectionWebhook input that doesn't
    already have one. Power Automate refuses to bind a connection at import
    time without it.
    """
    for action in actions.values():
        atype = action.get("type")
        if atype in ("OpenApiConnection", "OpenApiConnectionWebhook"):
            inputs = action.setdefault("inputs", {})
            inputs.setdefault("authentication", "@parameters('$authentication')")
        # If/Switch/Scope/Foreach can have nested actions
        if "actions" in action and isinstance(action["actions"], dict):
            add_authentication_parameter(action["actions"])
        if "else" in action and isinstance(action["else"], dict):
            add_authentication_parameter(action["else"].get("actions", {}))
        if "cases" in action and isinstance(action["cases"], dict):
            for case in action["cases"].values():
                add_authentication_parameter(case.get("actions", {}))
        if "default" in action and isinstance(action["default"], dict):
            add_authentication_parameter(action["default"].get("actions", {}))


def add_trigger_authentication(triggers: dict) -> None:
    for trig in triggers.values():
        if trig.get("type") in ("OpenApiConnection", "OpenApiConnectionWebhook"):
            inputs = trig.setdefault("inputs", {})
            inputs.setdefault("authentication", "@parameters('$authentication')")


# Connector metadata.  These IDs are the public connector identifiers — the
# import wizard will resolve them against the user's tenant and prompt the
# user to pick / create a real connection.
OFFICE365_API_ID = "/providers/Microsoft.PowerApps/apis/shared_office365"
OFFICE365_API_NAME = "shared_office365"
OFFICE365_DISPLAY = "Office 365 Outlook"
OFFICE365_ICON = (
    "https://connectoricons-prod.azureedge.net/releases/v1.0.1467/1.0.1467.2407/"
    "office365/icon.png"
)

APPROVALS_API_ID = "/providers/Microsoft.PowerApps/apis/shared_approvals"
APPROVALS_API_NAME = "shared_approvals"
APPROVALS_DISPLAY = "Approvals"
APPROVALS_ICON = (
    "https://connectoricons-prod.azureedge.net/releases/v1.0.1467/1.0.1467.2407/"
    "approvals/icon.png"
)


CONNECTOR_REGISTRY = {
    OFFICE365_API_NAME: {
        "id": OFFICE365_API_ID,
        "display": OFFICE365_DISPLAY,
        "icon": OFFICE365_ICON,
    },
    APPROVALS_API_NAME: {
        "id": APPROVALS_API_ID,
        "display": APPROVALS_DISPLAY,
        "icon": APPROVALS_ICON,
    },
}


def discover_connector_names(definition: dict) -> list[str]:
    """Walk the workflow to find every connectionName referenced under host blocks."""
    found: set[str] = set()

    def walk(obj):
        if isinstance(obj, dict):
            host = obj.get("host")
            if isinstance(host, dict) and isinstance(host.get("connectionName"), str):
                name = host["connectionName"]
                if name in CONNECTOR_REGISTRY:
                    found.add(name)
            for v in obj.values():
                walk(v)
        elif isinstance(obj, list):
            for item in obj:
                walk(item)

    walk(definition.get("triggers", {}))
    walk(definition.get("actions", {}))
    # Stable order makes the output deterministic
    return sorted(found)


def build_flow_resource(
    *,
    flow_id: str,
    display_name: str,
    description: str,
    depends_on: list[str],
) -> dict:
    return {
        "type": "Microsoft.Flow/flows",
        "suggestedCreationType": "New",
        "creationType": "New",
        "details": {"displayName": display_name, "description": description},
        "configurableBy": "User",
        "hierarchy": "Root",
        "dependsOn": depends_on,
    }


def build_api_resource(connector_name: str) -> dict:
    meta = CONNECTOR_REGISTRY[connector_name]
    return {
        "id": meta["id"],
        "name": connector_name,
        "type": "Microsoft.PowerApps/apis",
        "suggestedCreationType": "Existing",
        "details": {"displayName": meta["display"], "iconUri": meta["icon"]},
        "configurableBy": "System",
        "hierarchy": "Child",
        "dependsOn": [],
    }


def build_connection_resource(connector_name: str, api_resource_id: str) -> dict:
    meta = CONNECTOR_REGISTRY[connector_name]
    return {
        "type": "Microsoft.PowerApps/apis/connections",
        "suggestedCreationType": "Existing",
        "creationType": "Existing",
        "details": {
            "displayName": meta["display"],
            "iconUri": meta["icon"],
        },
        "configurableBy": "User",
        "hierarchy": "Child",
        "dependsOn": [api_resource_id],
    }


def build_package(
    *,
    package_name: str,
    display_name: str,
    description: str,
    flow_definition_path: Path,
    output_path: Path,
) -> None:
    raw_definition = json.loads(flow_definition_path.read_text("utf-8"))

    # The Power Automate definition format requires every connector
    # action / trigger to carry an authentication parameter. Add it
    # if it's missing.
    add_authentication_parameter(raw_definition.get("actions", {}))
    add_trigger_authentication(raw_definition.get("triggers", {}))

    # Make sure the definition declares the $connections / $authentication
    # parameters Power Automate expects.
    params = raw_definition.setdefault("parameters", {})
    params.setdefault(
        "$connections",
        {"defaultValue": {}, "type": "Object"},
    )
    params.setdefault(
        "$authentication",
        {"defaultValue": {}, "type": "SecureObject"},
    )

    flow_id = str(uuid.uuid4())
    connectors = discover_connector_names(raw_definition)

    # Allocate a stable api/connection resource id per connector used in
    # this flow. Power Automate's import wizard groups them in the UI.
    api_resource_ids: dict[str, str] = {n: str(uuid.uuid4()) for n in connectors}
    connection_resource_ids: dict[str, str] = {n: str(uuid.uuid4()) for n in connectors}

    connection_references = {
        n: {
            "connectionName": n,
            "source": "Embedded",
            "id": CONNECTOR_REGISTRY[n]["id"],
            "tier": "NotSpecified",
        }
        for n in connectors
    }

    # Per-flow definition.json — the manual export wraps the workflow
    # definition in a small Microsoft.Flow envelope.
    flow_definition = {
        "name": flow_id,
        "id": f"/providers/Microsoft.Flow/flows/{flow_id}",
        "type": "Microsoft.Flow/flows",
        "properties": {
            "apiId": "/providers/Microsoft.PowerApps/apis/shared_logicflows",
            "displayName": display_name,
            "definition": raw_definition,
            "connectionReferences": connection_references,
            "flowFailureAlertSubscribed": False,
            "isManaged": False,
        },
        "schemaVersion": "1.0.0.0",
    }

    apis_map = {n: api_resource_ids[n] for n in connectors}
    connections_map = {n: connection_resource_ids[n] for n in connectors}

    flow_resource = build_flow_resource(
        flow_id=flow_id,
        display_name=display_name,
        description=description,
        depends_on=[
            *(api_resource_ids[n] for n in connectors),
            *(connection_resource_ids[n] for n in connectors),
        ],
    )

    resources: dict[str, dict] = {flow_id: flow_resource}
    for n in connectors:
        resources[api_resource_ids[n]] = build_api_resource(n)
        resources[connection_resource_ids[n]] = build_connection_resource(
            n, api_resource_ids[n]
        )

    package_manifest = {
        "schema": "1.0",
        "details": {
            "displayName": display_name,
            "description": description,
            "createdTime": utc_now_iso(),
            "packageTelemetryId": str(uuid.uuid4()),
            "creator": "WOW Refund Platform",
            "sourceEnvironment": "",
        },
        "resources": resources,
    }

    flows_index_manifest = {
        "packageSchemaVersion": "1.0",
        "flowAssets": {"assetPaths": [flow_id]},
    }

    output_path.parent.mkdir(parents=True, exist_ok=True)
    if output_path.exists():
        output_path.unlink()

    with zipfile.ZipFile(output_path, "w", zipfile.ZIP_DEFLATED) as zf:

        def write_json(arcname: str, data: dict) -> None:
            zf.writestr(arcname, json.dumps(data, separators=(",", ":")))

        write_json("manifest.json", package_manifest)
        write_json("Microsoft.Flow/flows/manifest.json", flows_index_manifest)
        write_json(
            f"Microsoft.Flow/flows/{flow_id}/definition.json", flow_definition
        )
        write_json(
            f"Microsoft.Flow/flows/{flow_id}/apisMap.json", apis_map
        )
        write_json(
            f"Microsoft.Flow/flows/{flow_id}/connectionsMap.json", connections_map
        )

    print(
        f"  built {output_path.relative_to(REPO_DOCS.parent)}\n"
        f"     flowId={flow_id}\n"
        f"     name=\"{display_name}\"",
        file=sys.stderr,
    )


def main() -> int:
    PACKAGES_DIR.mkdir(parents=True, exist_ok=True)

    build_package(
        package_name="wow-outbound-mailer",
        display_name="WOW Refund — Outbound mailer (HTTP → Outlook)",
        description=(
            "HTTP-triggered flow used by the WOW Refund platform to send "
            "approval / KNET / Aura emails through the operator mailbox. "
            "Trigger URL is the secret; the X-Wow-Signature header is logged "
            "for forensics. Use the -hmac variant for tenants that require "
            "server-side signature verification."
        ),
        flow_definition_path=FLOWS_DIR / "outbound-flow-definition.json",
        output_path=PACKAGES_DIR / "wow-outbound-mailer.zip",
    )

    build_package(
        package_name="wow-inbound-listener",
        display_name="WOW Refund — Inbound listener (Outlook → webhook)",
        description=(
            "Mailbox trigger flow used by the WOW Refund platform to forward "
            "approval / KNET / Aura replies into the platform webhook. "
            "Filters on subject prefixes (APB- / KNET- / AURA-) and posts an "
            "unsigned payload — only safe when the platform's "
            "POWER_AUTOMATE_INBOUND_SECRET is unset. Use the -hmac variant "
            "for HMAC-secured production deployments."
        ),
        flow_definition_path=FLOWS_DIR / "inbound-flow-definition.json",
        output_path=PACKAGES_DIR / "wow-inbound-listener.zip",
    )

    build_package(
        package_name="wow-outbound-mailer-hmac",
        display_name="WOW Refund — Outbound mailer (HMAC-secured)",
        description=(
            "Same as wow-outbound-mailer, but verifies the X-Wow-Signature "
            "HMAC-SHA256 header by calling the WOW Refund Azure Function HMAC "
            "helper before sending the email. Requires the helper to be "
            "deployed first (see docs/power-automate/azure-function-hmac/)."
        ),
        flow_definition_path=FLOWS_DIR / "outbound-flow-definition.hmac.json",
        output_path=PACKAGES_DIR / "wow-outbound-mailer-hmac.zip",
    )

    build_package(
        package_name="wow-inbound-listener-hmac",
        display_name="WOW Refund — Inbound listener (HMAC-secured)",
        description=(
            "Same as wow-inbound-listener, but signs the body with HMAC-SHA256 "
            "via the WOW Refund Azure Function HMAC helper before posting to "
            "the webhook. Use this when POWER_AUTOMATE_INBOUND_SECRET is set "
            "on the platform."
        ),
        flow_definition_path=FLOWS_DIR / "inbound-flow-definition.hmac.json",
        output_path=PACKAGES_DIR / "wow-inbound-listener-hmac.zip",
    )

    build_package(
        package_name="wow-approval-batch",
        display_name="WOW Refund — Approval batch (HTTP → Approvals → webhook)",
        description=(
            "Higher-level alternative to the plain outbound mailer for "
            "approval_batch_request emails. Sends a real Microsoft Approvals "
            "card (Approve / Reject buttons) instead of a plain email, waits "
            "for the manager's response, and posts the structured outcome "
            "back to the platform's inbound webhook. Use as "
            "POWER_AUTOMATE_WEBHOOK_URL only for approval-batch emails — "
            "keep the plain mailer for KNET / Aura / OTP / SYSTEM emails."
        ),
        flow_definition_path=FLOWS_DIR / "approval-batch-flow-definition.json",
        output_path=PACKAGES_DIR / "wow-approval-batch.zip",
    )

    return 0


if __name__ == "__main__":
    sys.exit(main())
