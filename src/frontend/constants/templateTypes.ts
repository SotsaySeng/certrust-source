/**
 * Shared design-template / achievement "template type" metadata.
 *
 * Both an achievement (issue.vue's template picker) and a design-template
 * (pages/design-templates/*) are categorized by the same 6-value
 * templateType/type enum (certificate/badge/transcript/training_record/
 * assessment/letter - see the backend's achievement and design-template
 * schemas). Extracted here so the icon/chip-color map has one home instead
 * of being duplicated per page - originally inline-only in issue.vue.
 *
 * Labels are intentionally NOT included here: they need the calling
 * component's own useI18n() `t()` function, so each page keeps a tiny
 * local `getTemplateTypeLabel(type)` that calls `t('issue.templateTypes.' + type)`.
 */

export type TemplateType = 'certificate' | 'badge' | 'transcript' | 'training_record' | 'assessment' | 'letter'

export const TEMPLATE_TYPES: TemplateType[] = ['certificate', 'badge', 'transcript', 'training_record', 'assessment', 'letter']

export const TEMPLATE_TYPE_ICONS: Record<TemplateType, string> = {
  badge: 'i-heroicons-star',
  certificate: 'i-heroicons-academic-cap',
  transcript: 'i-heroicons-document-text',
  training_record: 'i-heroicons-clipboard-document-check',
  assessment: 'i-heroicons-clipboard-document-list',
  letter: 'i-heroicons-envelope-open',
}

export const TEMPLATE_TYPE_CHIP_CLASSES: Record<TemplateType, string> = {
  badge: 'bg-amber-50 text-amber-700',
  certificate: 'bg-blue-50 text-blue-700',
  transcript: 'bg-slate-100 text-slate-700',
  training_record: 'bg-teal-50 text-teal-700',
  assessment: 'bg-indigo-50 text-indigo-700',
  letter: 'bg-rose-50 text-rose-700',
}

export function getTemplateTypeIcon(type: string): string {
  return TEMPLATE_TYPE_ICONS[type as TemplateType] || TEMPLATE_TYPE_ICONS.badge
}

export function getTemplateTypeChipClass(type: string): string {
  return TEMPLATE_TYPE_CHIP_CLASSES[type as TemplateType] || TEMPLATE_TYPE_CHIP_CLASSES.badge
}
