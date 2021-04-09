<template lang="pug">
  .gsbutton(@click="onClick" :class="disabled? 'disabled' : ''")
    slot(name="icon").icon
    .text {{ text }}
</template>

<script lang="ts">
import { Vue } from 'vue-property-decorator';

export default Vue.extend({
  name: 'GSButton',
  props: {
    text: {
      type: String,
      default: '',
    },
    disabled: {
      type: Boolean,
      default: false,
    },
  },
  methods: {
    onClick() {
      if (!this.disabled) this.$emit('click');
    },
  },
});
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped lang="scss">

$color-disabled: #b6b6b6;
$color-default: #00897b;
$color-hover: #4ebaaa;

$outline-thickness: 3px;

.gsbutton {
  cursor: pointer;
  position: relative;
  font-family: 'Inconsolata', monospace;
  width: fit-content;
  height: fit-content;

  padding: 1rem 2rem;

  margin: 2rem auto;
  color: inherit;

  outline: $outline-thickness solid $color-default;
  box-shadow: 0px 4px 8px 4px rgba(0, 0, 0, 0.2);

  &.disabled {
    cursor: default;
    outline: $outline-thickness solid $color-disabled;
    box-shadow: 0px 4px 4px 2px rgba(0, 0, 0, 0.2);

    color: $color-disabled;
  }

  &:hover:not(.disabled) {
    outline: $outline-thickness solid $color-hover;
    box-shadow: 0px 4px 16px 8px rgba(0, 0, 0, 0.2);
  }

  transition: none 300ms ease-in-out;
  transition-property: box-shadow, outline;

  display: grid;
  grid-template-columns: 4fr 6fr;
}

.text {
  margin: auto auto auto 1rem;
  height: fit-content;
  max-height: 100%;
}

</style>
