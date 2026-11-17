<template>
  <div v-if="value" class="code-preview" :title="value">
    <div v-for="(line, index) in preview" :key="index" class="line">
      <span class="number">{{ index + 1 }}</span>
      <code>{{ line || ' ' }}</code>
      <span v-if="index === preview.length - 1 && hiddenLines > 0" class="more">+{{ hiddenLines }}</span>
    </div>
  </div>
  <span v-else class="empty">—</span>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  value: { type: String, default: null },
  lines: { type: Number, default: 1 },
});

const allLines = computed(() => (props.value ?? '').replace(/\r\n/g, '\n').split('\n'));
const preview = computed(() => allLines.value.slice(0, Math.max(1, props.lines ?? 1)));
const hiddenLines = computed(() => allLines.value.length - preview.value.length);
</script>

<style scoped>
.code-preview {
  display: flex;
  flex-direction: column;
  min-width: 0;
  font-family: var(--theme--fonts--monospace--font-family, monospace);
  font-size: 12px;
  line-height: 1.4;
}

.line {
  display: flex;
  gap: 8px;
  min-width: 0;
}

.number {
  flex-shrink: 0;
  width: 1.5em;
  text-align: right;
  color: var(--theme--foreground-subdued);
  user-select: none;
}

code {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: pre;
  color: var(--theme--foreground);
  font-family: inherit;
  background: none;
}

.more {
  flex-shrink: 0;
  padding: 0 6px;
  border-radius: 8px;
  background: var(--theme--background-accent);
  color: var(--theme--foreground-subdued);
  font-size: 11px;
}

.empty {
  color: var(--theme--foreground-subdued);
  font-size: 11px;
}
</style>
