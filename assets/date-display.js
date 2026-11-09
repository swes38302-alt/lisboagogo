/* Stable calendar-date presentation; stored ISO values stay unchanged. */
(function (root) {
    const formatDate = value => {
        if (!value) return '';
        const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})(?:$|T)/);
        if (!match) return String(value);
        return `${match[1]}/${match[2]}/${match[3]}`;
    };
    const formatDateTime = value => {
        const date = formatDate(value);
        const time = String(value || '').match(/T(\d{2}:\d{2})/);
        return time ? `${date} ${time[1]}` : date;
    };
    const component = {
        props: {
            modelValue: { type: String, default: '' },
            disabled: Boolean,
            label: { type: String, default: '日期' },
            type: { type: String, default: 'date' }
        },
        emits: ['update:modelValue', 'change'],
        computed: {
            displayValue() { return (this.type === 'datetime-local' ? formatDateTime : formatDate)(this.modelValue); }
        },
        methods: {
            update(event) { this.$emit('update:modelValue', event.target.value); },
            change(event) { this.$emit('change', event); },
            open(event) {
                if (this.disabled) return;
                try { event.currentTarget.showPicker?.(); } catch (_) { /* Native input remains available. */ }
            }
        },
        template: `<label class="date-field" :class="{'date-field-disabled':disabled}">
            <span class="date-field-text" aria-hidden="true">{{ displayValue || 'YYYY/MM/DD' }}</span>
            <input class="date-field-native" :type="type" :value="modelValue" :disabled="disabled"
                :aria-label="label + (displayValue ? '，' + displayValue : '')" @input="update" @change="change" @click="open">
        </label>`
    };
    root.DateDisplay = { formatDate, formatDateTime, component };
    if (typeof module !== 'undefined' && module.exports) module.exports = root.DateDisplay;
})(globalThis);
