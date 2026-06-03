<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue';
import LoginView from './views/LoginView.vue';
import DocumentsView from './views/DocumentsView.vue';
import ChatView from './views/ChatView.vue';

const isAuthenticated = ref(Boolean(localStorage.getItem('token')));
const currentPath = ref(window.location.pathname);

const chatDocumentId = computed(() => {
  const match = currentPath.value.match(/^\/documents\/([^/]+)\/chat$/);
  return match?.[1] || '';
});

const syncPath = () => {
  currentPath.value = window.location.pathname;
};

const navigateTo = (path) => {
  window.history.pushState({}, '', path);
  syncPath();
};

const handleLoginSuccess = () => {
  isAuthenticated.value = true;
  navigateTo('/documents');
};

const handleLogout = () => {
  localStorage.removeItem('token');
  isAuthenticated.value = false;
  navigateTo('/');
};

const openChat = (documentId) => {
  navigateTo(`/documents/${documentId}/chat`);
};

const backToDocuments = () => {
  navigateTo('/documents');
};

onMounted(() => {
  window.addEventListener('popstate', syncPath);
});

onUnmounted(() => {
  window.removeEventListener('popstate', syncPath);
});
</script>

<template>
  <LoginView v-if="!isAuthenticated" @login-success="handleLoginSuccess" />

  <ChatView
    v-else-if="chatDocumentId"
    :document-id="chatDocumentId"
    @back="backToDocuments"
    @open-chat="openChat"
    @logout="handleLogout"
    @auth-expired="handleLogout"
  />

  <DocumentsView
    v-else
    @open-chat="openChat"
    @logout="handleLogout"
    @auth-expired="handleLogout"
  />
</template>
