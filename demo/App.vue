<script setup lang="ts">
import { ref } from 'vue'
import { StickToBottom } from 'vue-stick-to-bottom'
import ScrollToBottom from './components/ScrollToBottom.vue'
import StopScroll from './components/StopScroll.vue'
import { useFakeMessages } from './composables/useFakeMessages'

const speed = ref(0.2)
const messagesA = useFakeMessages(speed)
const messagesB = useFakeMessages(speed)
</script>

<template>
  <div class="flex flex-col gap-10 p-10 items-center w-full">
    <input
      v-model.number="speed"
      class="w-full max-w-screen-lg"
      type="range"
      min="0"
      max="1"
      step="0.01"
    >

    <div class="flex gap-6 w-full max-w-screen-lg">
      <div class="prose flex flex-col gap-2 w-full overflow-hidden">
        <h2 class="flex justify-center">
          smooth:
        </h2>
        <StickToBottom class="h-[50vh] flex flex-col" :initial="{ mass: 10 }" anchor="none">
          <div class="flex flex-col gap-4 p-6 select-text">
            <div
              v-for="i in 10"
              :key="`placeholder-${i}`"
              class="bg-gray-100 rounded-lg p-4 shadow-md break-words"
            >
              <h1>This is a test</h1>
              more testing text...
            </div>

            <div
              v-for="m in messagesA"
              :key="m.id"
              class="rounded-lg p-4 shadow-md break-words"
              :class="m.large ? 'bg-gray-100 text-4xl font-extrabold leading-tight' : 'bg-gray-100'"
            >
              {{ m.text }}
            </div>
          </div>

          <template #overlay>
            <ScrollToBottom />
          </template>
          <template #after>
            <StopScroll />
          </template>
        </StickToBottom>
      </div>

      <div class="prose flex flex-col gap-2 w-full overflow-hidden">
        <h2 class="flex justify-center">
          instant:
        </h2>
        <StickToBottom class="h-[50vh] flex flex-col" resize="instant" initial="instant" anchor="none">
          <div class="flex flex-col gap-4 p-6 select-text">
            <div
              v-for="i in 10"
              :key="`placeholder-${i}`"
              class="bg-gray-100 rounded-lg p-4 shadow-md break-words"
            >
              <h1>This is a test</h1>
              more testing text...
            </div>

            <div
              v-for="m in messagesB"
              :key="m.id"
              class="rounded-lg p-4 shadow-md break-words"
              :class="m.large ? 'bg-gray-100 text-4xl font-extrabold leading-tight' : 'bg-gray-100'"
            >
              {{ m.text }}
            </div>
          </div>

          <template #overlay>
            <ScrollToBottom />
          </template>
          <template #after>
            <StopScroll />
          </template>
        </StickToBottom>
      </div>
    </div>
  </div>
</template>
