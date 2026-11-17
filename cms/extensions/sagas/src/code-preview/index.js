import { defineDisplay } from '@directus/extensions-sdk';
import DisplayComponent from './display.vue';

export default defineDisplay({
  id: 'code-preview',
  name: 'Code preview',
  icon: 'code',
  description: 'First lines of a code snippet in a monospace font, with line numbers',
  component: DisplayComponent,
  types: ['text', 'string'],
  options: [
    {
      field: 'lines',
      name: 'Lines to show',
      type: 'integer',
      meta: { interface: 'input', width: 'half', options: { min: 1, max: 10 } },
      schema: { default_value: 1 },
    },
  ],
});
