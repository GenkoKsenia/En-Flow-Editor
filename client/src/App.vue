<template>
  <div id="app">
    <header class="topbar">
      <div class="brand">
        <img src="/image/logo.png" alt="logo" class="logo" />
      </div>
      <div class="user-block">
        <div class="user-avatar">
          <span class="avatar-main">OP</span>
        </div>
        <div class="user-info">
          <div class="user-name">Фамилия И.О.</div>
          <div class="user-email">username@gmail.ru</div>
        </div>
        <div class="user-divider"></div>
        <div class="user-actions">
          <img src="/icon/IconExit.png" alt="exit" class="exit-icon" />
        </div>
      </div>
    </header>
    <main class="main">
      <FlowEditor />
    </main>
  </div>
</template>

<script setup lang="ts">
import FlowEditor from './components/FlowEditor.vue'
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
}

#app {
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

h1 {
  padding: 20px;
  background: #2c3e50;
  color: white;
  text-align: center;
}

.topbar {
  height: 56px;
  background: #fff;
  border-bottom: 1px solid #dfe3e8;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 48px;
}

.brand {
  display: flex;
  align-items: center;
  height: 100%;
}

.logo {
  height: 40px;
  object-fit: contain;
}

.user-block {
  display: flex;
  align-items: center;
  gap: 12px;
}

.user-avatar {
  width: 36px;
  height: 36px;
  background: #c0c2c5;
  color: #fff;
  border-radius: 4px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  line-height: 12px;
  font-weight: 700;
}

.avatar-main {
  font-size: 11px;
}

.avatar-sub {
  font-size: 9px;
  opacity: 0.9;
}

.user-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 13px;
  color: #2f2f2f;
}

.user-name {
  font-weight: 700;
  font-size: 14px;
}

.user-email {
  font-size: 12px;
  color: #555;
}

.user-divider {
  width: 1px;
  height: 24px;
  background: #d0d4d8;
}

.user-actions {
  display: flex;
  align-items: center;
}

.exit-icon {
  width: 18px;
  height: 18px;
  opacity: 0.8;
}
</style>
