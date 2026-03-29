<template>
  <div class="app-shell">
    <AppHeader :clickable="isEditorRoute" @logo-click="onLogoClick" />
    <main class="main">
      <RouterView />
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { RouterView, useRoute, useRouter } from 'vue-router'

import AppHeader from './AppHeader.vue'

const route = useRoute()
const router = useRouter()

const isEditorRoute = computed(() => route.name === 'scheme-editor')

function onLogoClick(): void {
  if (!isEditorRoute.value) return
  void router.push({ name: 'schemes' })
}
</script>

<style scoped>
.app-shell {
  height: 100vh;
  display: flex;
  flex-direction: column;
}

.main {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
</style>
