<template>
  <div id="app">
    <h1>En+Flow Editor</h1>
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
</style>