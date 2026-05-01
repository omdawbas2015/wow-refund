/**
 * Default email templates — editable from admin panel.
 * Placeholders use {{variable}} syntax.
 */

export interface EmailTemplateSeed {
  key: string;
  category: string;
  locale: string;
  subject: string;
  body: string;
  placeholders: string[];
  description: string;
}

export const emailTemplates: readonly EmailTemplateSeed[] = [
  // ─── Auth ───
  {
    key: 'AUTH_OTP_PASSWORD_RESET',
    category: 'Auth',
    locale: 'en',
    subject: 'Your WOW Refund password reset code',
    body:
      'Hi {{name}},\n\nYour verification code is: {{code}}\n\nThis code expires in {{ttl}} minutes. If you did not request this, please ignore this email.\n\n— WOW Refund',
    placeholders: ['name', 'code', 'ttl'],
    description: 'Sent when a user requests a password reset.',
  },
  {
    key: 'AUTH_OTP_PASSWORD_RESET',
    category: 'Auth',
    locale: 'ar',
    subject: 'رمز إعادة تعيين كلمة المرور',
    body:
      'مرحباً {{name}}،\n\nرمز التحقق الخاص بك: {{code}}\n\nينتهي هذا الرمز خلال {{ttl}} دقيقة. إذا لم تطلب إعادة تعيين كلمة المرور، تجاهل هذه الرسالة.\n\n— WOW Refund',
    placeholders: ['name', 'code', 'ttl'],
    description: 'Arabic version of password reset OTP.',
  },
  {
    key: 'AUTH_ADMIN_NEW_SIGNUP',
    category: 'Auth',
    locale: 'en',
    subject: '[WOW Refund] New signup awaiting approval: {{email}}',
    body:
      'A new user has signed up and is awaiting approval:\n\nName: {{name}}\nEmail: {{email}}\nSubmitted: {{submittedAt}}\n\nReview and approve at: {{approvalUrl}}',
    placeholders: ['name', 'email', 'submittedAt', 'approvalUrl'],
    description: 'Sent to admins when a new user signs up.',
  },
  {
    key: 'AUTH_SIGNUP_APPROVED',
    category: 'Auth',
    locale: 'en',
    subject: 'Your WOW Refund account has been approved',
    body:
      'Hi {{name}},\n\nYour account has been approved. You can now log in and set your password.\n\nLogin: {{loginUrl}}\n\n— WOW Refund',
    placeholders: ['name', 'loginUrl'],
    description: 'Sent to the user when admin approves their signup.',
  },

  // ─── Approval Batch ───
  {
    key: 'APPROVAL_BATCH_MANAGER',
    category: 'Manager',
    locale: 'en',
    subject: '[WOW Refund] Daily approval batch — {{country}} — {{date}} ({{count}} cases)',
    body:
      'Dear {{managerName}},\n\nYou have {{count}} refund case(s) awaiting your approval for {{country}} on {{date}}.\n\nApproval table:\n{{casesTable}}\n\nTotal amount: {{totalAmount}}\n\nTo approve: reply with "approved" followed by case numbers, or click the link below.\nTo reject: reply with "rejected" and the reason.\n\nApproval link: {{approvalUrl}}\n\n— WOW Refund',
    placeholders: ['managerName', 'country', 'date', 'count', 'casesTable', 'totalAmount', 'approvalUrl'],
    description: 'Sent daily to country managers with pending approvals.',
  },

  // ─── KNET Batch ───
  {
    key: 'KNET_BATCH_FINANCE',
    category: 'Finance',
    locale: 'en',
    subject: '[WOW Refund] KNET refund batch — {{date}} ({{count}} transactions)',
    body:
      'Dear Finance team,\n\nPlease process {{count}} KNET refunds for {{date}}.\n\nBatch details:\n{{componentsTable}}\n\nTotal amount: {{totalAmount}}\n\nAfter processing, please reply with the ARN for each transaction.\n\nExpected format:\n{{expectedFormat}}\n\n— WOW Refund',
    placeholders: ['date', 'count', 'componentsTable', 'totalAmount', 'expectedFormat'],
    description: 'Sent daily to Finance team with approved KNET refunds awaiting ARN.',
  },

  // ─── Aura Batch ───
  {
    key: 'AURA_BATCH_TEAM',
    category: 'Aura',
    locale: 'en',
    subject: '[WOW Refund] Aura points refund — {{date}} ({{count}} orders)',
    body:
      'Dear Aura team,\n\nPlease process {{count}} Aura point refund(s) for {{date}}.\n\nOrders:\n{{ordersTable}}\n\nTotal points: {{totalPoints}}\n\nPlease confirm each order after processing.\n\n— WOW Refund',
    placeholders: ['date', 'count', 'ordersTable', 'totalPoints'],
    description: 'Sent daily to Aura team with pending point refunds.',
  },

  // ─── Customer ───
  {
    key: 'CUSTOMER_REFUND_COMPLETED',
    category: 'Customer',
    locale: 'en',
    subject: 'Your refund for order {{orderNumber}} has been processed',
    body:
      'Dear {{customerName}},\n\nYour refund for order {{orderNumber}} has been processed.\n\nRefund details:\n{{componentsTable}}\n\nTotal refunded: {{totalAmount}}\n\nPayment reference: {{arn}}\n\nPlease allow 3-7 business days for the amount to reflect in your account.\n\nThank you for shopping with {{brandName}}.\n\n— The {{brandName}} Team',
    placeholders: ['customerName', 'orderNumber', 'componentsTable', 'totalAmount', 'arn', 'brandName'],
    description: 'Sent to customer when their refund is completed.',
  },
  {
    key: 'CUSTOMER_REFUND_COMPLETED',
    category: 'Customer',
    locale: 'ar',
    subject: 'تم معالجة استرداد الطلب {{orderNumber}}',
    body:
      'عزيزي {{customerName}}،\n\nتم معالجة استرداد قيمة طلبك رقم {{orderNumber}}.\n\nتفاصيل الاسترداد:\n{{componentsTable}}\n\nالإجمالي: {{totalAmount}}\n\nرقم المرجع: {{arn}}\n\nقد يستغرق ظهور المبلغ في حسابك من 3 إلى 7 أيام عمل.\n\nشكراً لتسوقك من {{brandName}}.\n\n— فريق {{brandName}}',
    placeholders: ['customerName', 'orderNumber', 'componentsTable', 'totalAmount', 'arn', 'brandName'],
    description: 'Arabic version of customer refund completed email.',
  },
  {
    key: 'CUSTOMER_REFUND_FOLLOWUP_NO_ANSWER',
    category: 'Customer',
    locale: 'en',
    subject: 'Re: Your refund for order {{orderNumber}}',
    body:
      'Dear {{customerName}},\n\nWe tried to reach you to confirm that your refund for order {{orderNumber}} (payment reference {{arn}}) was processed successfully.\n\nIf the amount has reflected in your account, no further action is required from your side. If you need anything or have questions about the refund, please reply to this email and we will get back to you.\n\nThank you for shopping with {{brandName}}.\n\n— The {{brandName}} Team',
    placeholders: ['customerName', 'orderNumber', 'arn', 'brandName'],
    description:
      'Follow-up reply on the ARN email when the agent could not reach the customer by phone.',
  },
  {
    key: 'CUSTOMER_REFUND_FOLLOWUP_NO_ANSWER',
    category: 'Customer',
    locale: 'ar',
    subject: 'رد: استرداد طلبك رقم {{orderNumber}}',
    body:
      'عزيزي {{customerName}}،\n\nحاولنا التواصل معك للتأكيد على استرداد طلبك رقم {{orderNumber}} (رقم المرجع {{arn}}).\n\nإذا كان المبلغ قد ظهر في حسابك، فلا حاجة لاتخاذ أي إجراء من جانبك. وإذا كنت تحتاج إلى أي شيء أو لديك استفسار بخصوص الاسترداد، يرجى الرد على هذا البريد وسنتواصل معك.\n\nشكراً لتسوقك من {{brandName}}.\n\n— فريق {{brandName}}',
    placeholders: ['customerName', 'orderNumber', 'arn', 'brandName'],
    description:
      'Arabic version of the no-answer follow-up reply on the ARN email.',
  },
  {
    key: 'CUSTOMER_PROMO_COMPENSATION',
    category: 'Customer',
    locale: 'en',
    subject: 'A little something from {{brandName}}',
    body:
      'Dear {{customerName}},\n\nWe apologize for the inconvenience you experienced.\n\nAs a goodwill gesture, please use the following code on your next order at {{brandName}}:\n\nCode: {{promoCode}}\nValue: {{value}} {{currency}}\nExpires: {{expiresAt}}\n\nWe hope to serve you better next time.\n\n— The {{brandName}} Team',
    placeholders: ['customerName', 'brandName', 'promoCode', 'value', 'currency', 'expiresAt'],
    description: 'Sent with a customer compensation promo code.',
  },
  // ─── Branded Solutions (Help Desk / Maintenance pool) ───
  {
    key: 'MAINT_CUSTOMER_CONFIRMATION',
    category: 'Maintenance',
    locale: 'en',
    subject: 'Facilities Work Request Confirmation {{mrNumber}}',
    body:
      'Dear Valued Customer,\n\nWe are pleased to confirm that your maintenance request has been successfully submitted. Our support team is reviewing the details and will proceed with the necessary actions promptly.\n\nWORK REQUEST NUMBER\n{{mrNumber}}\n\nMachine Model: {{machineModel}}\nStore: {{storeName}}\nLocation: {{location}}\nIssue: {{issueType}}\n\nPlease keep this reference number for future communication.\n\nKind regards,\nALSHAYA TECHNICAL SERVICES',
    placeholders: ['mrNumber', 'machineModel', 'storeName', 'location', 'issueType'],
    description: 'Confirmation email sent to the external customer once the agent raises the Archibus MR and closes the maintenance ticket.',
  },
  {
    key: 'MAINT_CUSTOMER_CLARIFY',
    category: 'Maintenance',
    locale: 'en',
    subject: 'Need More Information About Your Maintenance Request',
    body:
      'Dear {{customerName}},\n\nThank you for reaching out to Alshaya Technical Services. To proceed with your request for {{machineModel}} at {{storeName}}, we need a bit more information:\n\n{{questions}}\n\nKindly reply to this email with the missing details so we can raise the work order.\n\nKind regards,\nALSHAYA TECHNICAL SERVICES',
    placeholders: ['customerName', 'machineModel', 'storeName', 'questions'],
    description: 'Sent to the external customer when the agent needs clarification on location / model / etc. before raising the MR.',
  },
  {
    key: 'MAINT_SUPERVISOR_LOCATION_VERIFY',
    category: 'Maintenance',
    locale: 'en',
    subject: 'Maintenance Location Verification Required — {{ticketRef}}',
    body:
      'Dear {{supervisorName}},\n\nWe received a maintenance request for your country ({{countryName}}) but the submitted location is unclear.\n\nTicket: {{ticketRef}}\nStore: {{storeName}}\nLocation as submitted: {{location}}\nMachine: {{machineModel}}\nIssue: {{issueType}}\nCustomer: {{customerName}} ({{contactNumber}})\nSubmitted by: {{submitterName}}\n\nKindly advise the correct location / branch reference so we can raise the Archibus work order.\n\nKind regards,\nALSHAYA TECHNICAL SERVICES',
    placeholders: ['supervisorName', 'countryName', 'ticketRef', 'storeName', 'location', 'machineModel', 'issueType', 'customerName', 'contactNumber', 'submitterName'],
    description: 'Sent to the country supervisor when the agent flips a maintenance request to WAITING_FOR_SUPERVISOR because the location is unclear.',
  },
];
