<script setup>
import { ref } from 'vue';
import LoginView from './views/LoginView.vue';
import DocumentsView from './views/DocumentsView.vue';

const isAuthenticated = ref(Boolean(localStorage.getItem('token')));

const handleLoginSuccess = () => {
  isAuthenticated.value = true;
};

const handleLogout = () => {
  isAuthenticated.value = false;
};
</script>

<template>
  <LoginView v-if="!isAuthenticated" @login-success="handleLoginSuccess" />

  <DocumentsView
    v-else
    @logout="handleLogout"
    @auth-expired="handleLogout"
  />
</template>
