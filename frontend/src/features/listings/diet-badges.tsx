import { Badge } from '@/components/ui';
import { humanize } from '@/lib/format';

/**
 * Diet flags come from the moderation agent as free text. Most are ingredients to warn about
 * ("gluten", "dairy", "pork"), but some describe a diet the food suits ("vegan", "halal").
 * Those must not be shown as "contains vegan" in the warning colour.
 */
const SUITABLE_FOR = new Set([
  'vegan',
  'vegetarian',
  'halal',
  'kosher',
  'plant-based',
  'organic',
  'gluten-free',
  'dairy-free',
  'nut-free',
  'egg-free',
  'sugar-free',
]);

const normalise = (flag: string) =>
  flag
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-');

export const isSuitableFlag = (flag: string) => SUITABLE_FOR.has(normalise(flag));

/** Green "vegan" style labels first, then red "contains …" warnings. Renders nothing if empty. */
export function DietBadges({ flags, className }: { flags: string[]; className?: string }) {
  if (flags.length === 0) return null;
  const suitable = flags.filter(isSuitableFlag);
  const contains = flags.filter((f) => !isSuitableFlag(f));
  return (
    <div className={`flex flex-wrap gap-1 ${className ?? ''}`}>
      {suitable.map((f) => (
        <Badge key={f} tone="brand">
          {humanize(f)}
        </Badge>
      ))}
      {contains.map((f) => (
        <Badge key={f} tone="danger">
          contains {humanize(f)}
        </Badge>
      ))}
    </div>
  );
}
