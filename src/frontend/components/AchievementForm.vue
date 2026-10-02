<script setup lang="ts">
import { getTemplateTypeIcon, TEMPLATE_TYPES } from '~/constants/templateTypes'

/** The achievement fields shared by the create and edit pages. */
export interface AchievementFormValues {
  name: string
  description: string
  templateType: string
  criteria: string
  certificateDesignId: string | null
  badgeDesignId: string | null
}

defineProps<{
  submitLabel: string
  busy?: boolean
  error?: string | null
}>()

const emit = defineEmits<{ submit: [] }>()

const form = defineModel<AchievementFormValues>({ required: true })

const { t } = useI18n()

function getTemplateTypeLabel(type: string): string {
  return t(`issue.templateTypes.${type}`)
}
</script>

<template>
  <form class="space-y-6" @submit.prevent="emit('submit')">
    <div>
      <label for="achievementName" class="block text-sm font-medium text-text-primary mb-1">
        {{ t('achievements.nameLabel') }}
      </label>
      <input
        id="achievementName"
        v-model="form.name"
        type="text"
        required
        maxlength="200"
        :placeholder="t('achievements.namePlaceholder')"
        class="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#28A745] focus:border-transparent"
      >
    </div>

    <div>
      <label for="achievementDescription" class="block text-sm font-medium text-text-primary mb-1">
        {{ t('achievements.descriptionLabel') }}
      </label>
      <textarea
        id="achievementDescription"
        v-model="form.description"
        rows="3"
        required
        :placeholder="t('achievements.descriptionPlaceholder')"
        class="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#28A745] focus:border-transparent"
      />
      <p class="mt-1 text-xs text-text-secondary">
        {{ t('achievements.descriptionHint') }}
      </p>
    </div>

    <div>
      <span class="block text-sm font-medium text-text-primary mb-2">
        {{ t('achievements.typeLabel') }}
      </span>
      <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <label
          v-for="type in TEMPLATE_TYPES"
          :key="type"
          class="flex items-center gap-2 border rounded-lg px-3 py-2 cursor-pointer text-sm transition-colors"
          :class="form.templateType === type ? 'border-[#28A745] bg-[#28A745]/5' : 'border-gray-200 hover:border-[#28A745]/50'"
        >
          <input v-model="form.templateType" type="radio" name="templateType" :value="type" class="sr-only">
          <span class="w-4 h-4 text-[#28A745]" :class="getTemplateTypeIcon(type)" />
          {{ getTemplateTypeLabel(type) }}
        </label>
      </div>
    </div>

    <div>
      <label for="achievementCriteria" class="block text-sm font-medium text-text-primary mb-1">
        {{ t('achievements.criteriaLabel') }}
      </label>
      <textarea
        id="achievementCriteria"
        v-model="form.criteria"
        rows="3"
        :placeholder="t('achievements.criteriaPlaceholder')"
        class="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#28A745] focus:border-transparent"
      />
      <p class="mt-1 text-xs text-text-secondary">
        {{ t('achievements.criteriaHint') }}
      </p>
    </div>

    <div class="rounded-xl border border-gray-200 bg-gray-50/60 p-4">
      <p class="mb-1 text-sm font-medium text-text-primary">
        {{ t('designStudio.issue.designTitle') }}
      </p>
      <p class="mb-3 text-xs text-text-secondary">
        {{ t('designStudio.issue.achievementHint') }}
      </p>
      <div class="grid gap-3 md:grid-cols-2">
        <div>
          <p class="mb-1 text-xs font-medium text-text-secondary">
            {{ t('designStudio.issue.certificate') }}
          </p>
          <DesignStudioDesignPicker v-model="form.certificateDesignId" kind="certificate" />
        </div>
        <div>
          <p class="mb-1 text-xs font-medium text-text-secondary">
            {{ t('designStudio.issue.badge') }}
          </p>
          <DesignStudioDesignPicker v-model="form.badgeDesignId" kind="badge" />
        </div>
      </div>
    </div>

    <div v-if="error" class="rounded-lg bg-red-50 p-4">
      <p class="text-sm text-red-800">
        {{ error }}
      </p>
    </div>

    <div class="flex items-center gap-3">
      <button
        type="submit"
        :disabled="busy"
        class="px-6 py-2 bg-[#28A745] text-black rounded-full hover:bg-[#28A745]/90 transition-colors disabled:opacity-50"
      >
        <span v-if="!busy">{{ submitLabel }}</span>
        <div v-else class="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto" />
      </button>
      <slot name="actions" />
    </div>
  </form>
</template>
