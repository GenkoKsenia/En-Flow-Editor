import { createRouter, createWebHistory } from 'vue-router'

import AppLayout from '@/presentation/layouts/AppLayout.vue'
import FlowEditorPage from '@/presentation/pages/flow-editor/index.vue'
import SchemesListPage from '@/presentation/pages/schemes-list/index.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      component: AppLayout,
      children: [
        {
          path: '',
          redirect: { name: 'schemes' },
        },
        {
          path: 'schemes',
          name: 'schemes',
          component: SchemesListPage,
        },
        {
          path: 'schemes/:schemeId',
          name: 'scheme-editor',
          component: FlowEditorPage,
        },
      ],
    },
  ],
})

export default router
