<template>
  <div id="app">
    <div class="head">
      <div>
        <img src="/public/image/logo.png" alt="logo" class="logo">
      </div>
      
      <div class="account">
        <div class="avatar">ГК</div>
        <div class="info">
          <div>Генько К.П.</div>
          <div>genkoksenia@mail.ru</div>
        </div>
        <div class="exit"><img src="/public/icon/IconExit.png" alt="exit"></div>
      </div>
    </div>
    <FlowEditor />
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

h1 {
  padding: 20px;
  background: #2c3e50;
  color: white;
  text-align: center;
}

.head {
  height: 56px;
  background-color: #fff;
  padding-top: 8px;
  padding-left: 162px;
  padding-right: 162px;
}

.logo {
  height: 40px;
}

.account {
  justify-content: center;
}
</style>