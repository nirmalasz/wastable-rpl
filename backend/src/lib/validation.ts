import type { ZodError, ZodIssue } from 'zod';

const FIELD_LABELS: Record<string, string> = {
  email: 'Email',
  password: 'Password',
  name: 'Name',
  title: 'Title',
  description: 'Description',
  category: 'Category',
  quantity: 'Quantity',
  price: 'Price',
  listingType: 'Offer type',
  expiryDate: 'Expiry date',
  pickupArea: 'Pickup area',
  photoUrl: 'Photo',
  avatarUrl: 'Profile photo',
  reason: 'Reason',
  rating: 'Rating',
  comment: 'Comment',
  token: 'Link',
  text: 'Description',
  q: 'Search text',
  decision: 'Decision',
  status: 'Status',
  locationRadiusKm: 'Reminder radius',
  contactPreference: 'Contact preference',
};

const labelFor = (path: PropertyKey[]): string => {
  const key = String(path[path.length - 1] ?? 'value');
  if (FIELD_LABELS[key]) return FIELD_LABELS[key];
  const spaced = key.replace(/([A-Z])/g, ' $1').toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
};

/** Zod's own default messages start with these; anything else is a message we wrote for users. */
const isDefaultZodMessage = (m: string) =>
  /^(Invalid|Too small|Too big|Unrecognized|Input not|Expected)/.test(m);

/** Turns one zod issue into a sentence a user can act on. Never exposes schema internals. */
export function friendlyIssue(issue: ZodIssue): string {
  if (!isDefaultZodMessage(issue.message)) return issue.message;
  const label = labelFor(issue.path);
  const anyIssue = issue as ZodIssue & Record<string, unknown>;

  switch (issue.code) {
    case 'invalid_type':
      return anyIssue.input === undefined || /undefined|null/.test(issue.message)
        ? `${label} is required.`
        : `${label} is not in the expected format.`;
    case 'too_small': {
      const min = Number(anyIssue.minimum);
      if (anyIssue.origin === 'string') {
        return min <= 1
          ? `${label} cannot be empty.`
          : `${label} must be at least ${min} characters.`;
      }
      return `${label} must be at least ${min}.`;
    }
    case 'too_big': {
      const max = Number(anyIssue.maximum);
      return anyIssue.origin === 'string'
        ? `${label} must be at most ${max} characters.`
        : `${label} must be at most ${max}.`;
    }
    case 'invalid_format':
      if (anyIssue.format === 'email') return `${label} must be a valid email address.`;
      if (anyIssue.format === 'url') return `${label} must be a valid link.`;
      return `${label} is not in the expected format.`;
    case 'invalid_value':
      return `${label} has an unsupported value.`;
    case 'unrecognized_keys':
      return 'Some of the information you sent is not accepted.';
    default:
      return `${label} is not valid.`;
  }
}

export interface ValidationSummary {
  error: string;
  fields: Record<string, string>;
}

export function summarizeValidation(err: ZodError): ValidationSummary {
  const fields: Record<string, string> = {};
  const messages: string[] = [];
  for (const issue of err.issues) {
    const message = friendlyIssue(issue);
    const key = issue.path.map(String).join('.') || '_';
    if (!(key in fields)) {
      fields[key] = message;
      messages.push(message);
    }
  }
  return { error: messages.slice(0, 3).join(' ') || 'Please check your input.', fields };
}
