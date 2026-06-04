<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import api from '../api/api';

const props = defineProps({
  documentId: {
    type: String,
    required: true,
  },
});

const emit = defineEmits(['back', 'logout', 'auth-expired', 'open-chat']);

const document = ref(null);
const documents = ref([]);
const chats = ref([]);
const activeChatId = ref('');
const expandedDocumentId = ref(props.documentId);
const editingChatId = ref('');
const editingChatTitle = ref('');
const messages = ref([]);
const question = ref('');
const isLoadingDocument = ref(false);
const isLoadingMessages = ref(false);
const isAsking = ref(false);
const errorMessage = ref('');
const successMessage = ref('');
const messagesEnd = ref(null);

const isLoading = computed(
  () => isLoadingDocument.value || isLoadingMessages.value,
);

const flatMessages = computed(() =>
  messages.value.flatMap((message) => [
    {
      id: `${message.id || message.createdAt || message.question}-question`,
      role: 'user',
      text: message.question,
    },
    {
      id: `${message.id || message.createdAt || message.answer}-answer`,
      role: 'assistant',
      text: message.answer,
    },
  ]),
);

const getUserEmail = () => {
  const token = localStorage.getItem('token');

  if (!token) return 'Usuario';

  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.email || 'Usuario';
  } catch {
    return 'Usuario';
  }
};

const userEmail = ref(getUserEmail());

const friendlyError = (error, fallback) => {
  if (!error.response) {
    return 'No pudimos conectar con el servidor. Verifica que el backend este encendido.';
  }

  if (error.response.status === 404) {
    return 'Documento no encontrado.';
  }

  if (error.response.status >= 500) {
    return 'Hubo un error al generar la respuesta. Intenta nuevamente.';
  }

  return error.response.data?.message || fallback;
};

const handleAuthError = (error) => {
  if (error.response?.status === 401) {
    localStorage.removeItem('token');
    emit('auth-expired');
    return true;
  }

  return false;
};

const scrollToBottom = async () => {
  await nextTick();
  messagesEnd.value?.scrollIntoView({ behavior: 'smooth' });
};

const loadDocument = async () => {
  isLoadingDocument.value = true;
  errorMessage.value = '';

  try {
    const { data } = await api.get(`/documents/${props.documentId}`);
    document.value = data;
  } catch (error) {
    if (handleAuthError(error)) return;
    errorMessage.value = friendlyError(error, 'No pudimos cargar el documento.');
  } finally {
    isLoadingDocument.value = false;
  }
};

const loadDocuments = async () => {
  try {
    const { data } = await api.get('/documents');
    documents.value = data;
  } catch (error) {
    handleAuthError(error);
  }
};

const createChat = async () => {
  const { data } = await api.post(`/documents/${props.documentId}/chats`);
  chats.value = [data, ...chats.value];
  activeChatId.value = data.id;
  messages.value = [];
  return data;
};

const loadChats = async () => {
  try {
    const { data } = await api.get(`/documents/${props.documentId}/chats`);
    chats.value = data;

    if (data.length > 0) {
      activeChatId.value = data[0].id;
      return data[0];
    }

    return createChat();
  } catch (error) {
    if (handleAuthError(error)) return null;
    errorMessage.value = friendlyError(error, 'No pudimos cargar los chats.');
    return null;
  }
};

const loadMessages = async () => {
  if (!activeChatId.value) return;

  isLoadingMessages.value = true;
  errorMessage.value = '';

  try {
    const { data } = await api.get(
      `/documents/${props.documentId}/chats/${activeChatId.value}/messages`,
    );
    messages.value = data;
    await scrollToBottom();
  } catch (error) {
    if (handleAuthError(error)) return;
    errorMessage.value = friendlyError(error, 'No pudimos cargar el historial.');
  } finally {
    isLoadingMessages.value = false;
  }
};

const selectChat = async (chatId) => {
  if (editingChatId.value) return;

  activeChatId.value = chatId;
  messages.value = [];
  await loadMessages();
};

const toggleDocument = (documentId) => {
  if (documentId !== props.documentId) {
    expandedDocumentId.value = documentId;
    emit('open-chat', documentId);
    return;
  }

  expandedDocumentId.value =
    expandedDocumentId.value === documentId ? '' : documentId;
};

const startEditingChat = (chat) => {
  editingChatId.value = chat.id;
  editingChatTitle.value = chat.title;
};

const cancelEditingChat = () => {
  editingChatId.value = '';
  editingChatTitle.value = '';
};

const saveChatTitle = async (chatId) => {
  const title = editingChatTitle.value.trim();

  if (!title) {
    errorMessage.value = 'El nombre del chat no puede estar vacio.';
    return;
  }

  errorMessage.value = '';
  successMessage.value = '';

  try {
    const { data } = await api.patch(
      `/documents/${props.documentId}/chats/${chatId}`,
      { title },
    );

    chats.value = chats.value.map((chat) =>
      chat.id === chatId ? data : chat,
    );
    cancelEditingChat();
  } catch (error) {
    if (handleAuthError(error)) return;
    errorMessage.value = friendlyError(error, 'No pudimos editar el chat.');
  }
};

const deleteChat = async (chat) => {
  const confirmed = window.confirm(
    `Seguro que queres eliminar "${chat.title}"? Se borraran sus mensajes.`,
  );

  if (!confirmed) return;

  errorMessage.value = '';
  successMessage.value = '';

  try {
    await api.delete(`/documents/${props.documentId}/chats/${chat.id}`);
    chats.value = chats.value.filter((item) => item.id !== chat.id);

    if (activeChatId.value === chat.id) {
      const nextChat = chats.value[0] || (await createChat());
      activeChatId.value = nextChat.id;
      messages.value = [];
      await loadMessages();
    }

    successMessage.value = 'Chat eliminado correctamente.';
  } catch (error) {
    if (handleAuthError(error)) return;
    errorMessage.value = friendlyError(error, 'No pudimos eliminar el chat.');
  }
};

const askQuestion = async () => {
  const trimmedQuestion = question.value.trim();

  if (!trimmedQuestion || isAsking.value) return;

  errorMessage.value = '';
  successMessage.value = '';
  question.value = '';
  isAsking.value = true;

  if (!activeChatId.value) {
    await createChat();
  }

  const optimisticMessage = {
    id: `pending-${Date.now()}`,
    question: trimmedQuestion,
    answer: 'Pensando...',
  };

  messages.value = [...messages.value, optimisticMessage];
  await scrollToBottom();

  try {
    const { data } = await api.post(
      `/documents/${props.documentId}/chats/${activeChatId.value}/ask`,
      {
        question: trimmedQuestion,
        useHistory: true,
      },
    );

    messages.value = messages.value.map((message) =>
      message.id === optimisticMessage.id
        ? {
            ...message,
            answer: data.answer,
          }
        : message,
    );

    await loadMessages();
  } catch (error) {
    messages.value = messages.value.filter(
      (message) => message.id !== optimisticMessage.id,
    );

    if (handleAuthError(error)) return;
    errorMessage.value = friendlyError(error, 'No pudimos obtener una respuesta.');
  } finally {
    isAsking.value = false;
    await scrollToBottom();
  }
};

const startNewChat = () => {
  errorMessage.value = '';
  successMessage.value = '';
  isLoadingMessages.value = true;

  createChat()
    .then(() => {
      successMessage.value = 'Nuevo chat creado. Este chat empieza sin historial anterior.';
    })
    .catch((error) => {
      if (handleAuthError(error)) return;
      errorMessage.value = friendlyError(error, 'No pudimos crear un nuevo chat.');
    })
    .finally(() => {
      isLoadingMessages.value = false;
    });
};

const logout = () => {
  localStorage.removeItem('token');
  emit('logout');
};

watch(
  () => props.documentId,
  async () => {
    activeChatId.value = '';
    expandedDocumentId.value = props.documentId;
    messages.value = [];
    await Promise.all([loadDocument(), loadDocuments()]);
    await loadChats();
    await loadMessages();
  },
);

onMounted(async () => {
  await Promise.all([loadDocument(), loadDocuments()]);
  await loadChats();
  await loadMessages();
});
</script>

<template>
  <main class="chat-shell">
    <aside class="chat-sidebar">
      <div class="brand">
        <div class="brand-mark">AI</div>
        <div>
          <strong>ChatPDF</strong>
          <span>{{ userEmail }}</span>
        </div>
      </div>

      <button class="nav-button" type="button" @click="emit('back')">
        Mis documentos
      </button>

      <div class="sidebar-documents">
        <div
          v-for="item in documents"
          :key="item.id"
          class="sidebar-document-group"
        >
          <button
            class="sidebar-document"
            :class="{ selected: item.id === documentId }"
            type="button"
            @click="toggleDocument(item.id)"
          >
            <span class="document-caret" :class="{ open: expandedDocumentId === item.id }">
              ›
            </span>
            <span class="document-badge">PDF</span>
            <strong>{{ item.title }}</strong>
          </button>

          <Transition name="document-chats">
            <div
              v-if="expandedDocumentId === item.id && item.id === documentId"
              class="sidebar-chats nested"
            >
              <div
                v-for="chat in chats"
                :key="chat.id"
                class="sidebar-chat"
                :class="{ selected: chat.id === activeChatId }"
              >
                <template v-if="editingChatId === chat.id">
                  <input
                    v-model="editingChatTitle"
                    class="chat-title-input"
                    type="text"
                    @keydown.enter.prevent="saveChatTitle(chat.id)"
                    @keydown.esc.prevent="cancelEditingChat"
                  />
                  <div class="chat-actions">
                    <button type="button" @click="saveChatTitle(chat.id)">Guardar</button>
                    <button type="button" @click="cancelEditingChat">Cancelar</button>
                  </div>
                </template>

                <template v-else>
                  <button class="chat-select" type="button" @click="selectChat(chat.id)">
                    <strong>{{ chat.title }}</strong>
                    <span>{{ chat._count?.messages || 0 }} mensajes</span>
                  </button>

                  <div class="chat-actions">
                    <button type="button" @click="startEditingChat(chat)">Editar</button>
                    <button type="button" @click="deleteChat(chat)">Eliminar</button>
                  </div>
                </template>
              </div>
            </div>
          </Transition>
        </div>
      </div>

      <button class="nav-button" type="button" @click="startNewChat">
        Nuevo chat
      </button>

      <div class="sidebar-footer">
        <button class="ghost-button full" type="button" @click="logout">
          Cerrar sesion
        </button>
      </div>
    </aside>

    <section class="chat-main">
      <header class="chat-header">
        <div>
          <p class="eyebrow">Documento</p>
          <h1>{{ document?.title || 'Cargando documento...' }}</h1>
          <p v-if="document">
            {{ document.chunks?.length || 0 }} fragmentos disponibles para consultar.
          </p>
        </div>
      </header>

      <p v-if="successMessage" class="message success">{{ successMessage }}</p>
      <p v-if="errorMessage" class="message error">{{ errorMessage }}</p>

      <section class="chat-panel">
        <div v-if="isLoading" class="empty-chat">
          <span class="loader"></span>
          Cargando chat...
        </div>

        <div v-else-if="flatMessages.length === 0" class="empty-chat">
          <strong>Hacele una pregunta a tu PDF.</strong>
          <span>Por ejemplo: "Cuales son los puntos principales?"</span>
        </div>

        <div v-else class="messages">
          <article
            v-for="message in flatMessages"
            :key="message.id"
            class="chat-message"
            :class="message.role"
          >
            <div class="avatar">
              {{ message.role === 'user' ? 'TU' : 'AI' }}
            </div>
            <div class="bubble">
              {{ message.text }}
            </div>
          </article>
          <div ref="messagesEnd"></div>
        </div>
      </section>

      <footer class="composer-wrap">
        <form class="composer" @submit.prevent="askQuestion">
          <textarea
            v-model="question"
            rows="1"
            placeholder="Pregunta algo sobre este PDF..."
            :disabled="isAsking || isLoadingDocument"
            @keydown.enter.exact.prevent="askQuestion"
          ></textarea>
          <button
            class="send-button"
            type="submit"
            :disabled="isAsking || !question.trim()"
          >
            <span v-if="isAsking" class="button-loader"></span>
            <span v-else>Enviar</span>
          </button>
        </form>
      </footer>
    </section>
  </main>
</template>

<style scoped>
.chat-shell {
  width: 100%;
  height: 100dvh;
  display: grid;
  grid-template-columns: 280px 1fr;
  overflow: hidden;
  background: #eef2f7;
  color: #172033;
}

.chat-sidebar {
  min-width: 0;
  height: 100dvh;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 20px;
  border-right: 1px solid #d8e1ec;
  background: #101827;
  color: #ffffff;
}

.brand {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.brand-mark {
  width: 42px;
  height: 42px;
  display: grid;
  place-items: center;
  border-radius: 8px;
  background: #1f6feb;
  font-weight: 900;
}

.brand strong,
.brand span {
  display: block;
}

.brand span {
  max-width: 180px;
  overflow: hidden;
  color: #aebbd0;
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.nav-button,
.ghost-button,
.send-button {
  min-height: 42px;
  border-radius: 8px;
  padding: 0 14px;
  font: inherit;
  font-size: 14px;
  font-weight: 850;
  cursor: pointer;
}

.nav-button {
  border: 1px solid transparent;
  color: #d7e2f2;
  background: transparent;
  text-align: left;
}

.nav-button.active,
.nav-button:hover {
  background: #1b2638;
}

.sidebar-documents {
  display: grid;
  gap: 6px;
  max-height: 440px;
  overflow: auto;
  padding-right: 2px;
}

.sidebar-document-group {
  min-width: 0;
  display: grid;
  gap: 6px;
}

.sidebar-document {
  min-width: 0;
  display: grid;
  grid-template-columns: auto auto minmax(0, 1fr);
  align-items: center;
  gap: 8px;
  border: 0;
  border-radius: 8px;
  padding: 9px 10px;
  color: #d7e2f2;
  background: transparent;
  text-align: left;
  cursor: pointer;
}

.sidebar-document:hover,
.sidebar-document.selected {
  background: #1b2638;
}

.document-caret {
  display: inline-grid;
  place-items: center;
  color: #8fa0b8;
  font-size: 18px;
  line-height: 1;
  transform: rotate(0deg);
  transition: transform 0.22s ease;
}

.document-caret.open {
  transform: rotate(90deg);
}

.document-badge {
  color: #ffb4bd;
  font-size: 11px;
  font-weight: 950;
}

.sidebar-document strong {
  overflow: hidden;
  font-size: 13px;
  font-weight: 750;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sidebar-chats {
  display: grid;
  gap: 6px;
}

.sidebar-chats.nested {
  margin-left: 22px;
  padding-left: 10px;
  border-left: 1px solid #2a3850;
  overflow: hidden;
}

.document-chats-enter-active,
.document-chats-leave-active {
  transition:
    max-height 0.24s ease,
    opacity 0.2s ease,
    transform 0.24s ease;
}

.document-chats-enter-from,
.document-chats-leave-to {
  max-height: 0;
  opacity: 0;
  transform: translateY(-4px);
}

.document-chats-enter-to,
.document-chats-leave-from {
  max-height: 420px;
  opacity: 1;
  transform: translateY(0);
}

.sidebar-chat {
  display: grid;
  gap: 6px;
  border: 0;
  border-radius: 8px;
  padding: 8px;
  color: #d7e2f2;
  background: transparent;
  text-align: left;
}

.sidebar-chat:hover,
.sidebar-chat.selected {
  background: #1b2638;
}

.chat-select {
  min-width: 0;
  display: grid;
  gap: 2px;
  border: 0;
  padding: 0;
  color: inherit;
  background: transparent;
  text-align: left;
  cursor: pointer;
}

.chat-select strong {
  overflow: hidden;
  font-size: 13px;
  font-weight: 800;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chat-select span {
  color: #8fa0b8;
  font-size: 12px;
}

.chat-title-input {
  width: 100%;
  min-width: 0;
  border: 1px solid #34445e;
  border-radius: 6px;
  padding: 8px;
  color: #ffffff;
  background: #101827;
  font: inherit;
  font-size: 13px;
  outline: none;
}

.chat-title-input:focus {
  border-color: #1f6feb;
}

.chat-actions {
  display: flex;
  gap: 6px;
}

.chat-actions button {
  min-height: 28px;
  border: 1px solid #34445e;
  border-radius: 6px;
  padding: 0 8px;
  color: #d7e2f2;
  background: #162235;
  font: inherit;
  font-size: 12px;
  font-weight: 750;
  cursor: pointer;
}

.chat-actions button:hover {
  border-color: #536782;
}

.sidebar-footer {
  margin-top: auto;
}

.full {
  width: 100%;
}

.ghost-button {
  border: 1px solid #34445e;
  color: #d7e2f2;
  background: #162235;
}

.chat-main {
  min-width: 0;
  height: 100dvh;
  display: grid;
  grid-template-rows: auto auto 1fr auto;
  overflow: hidden;
  padding: 28px;
}

.chat-header,
.message,
.chat-panel,
.composer-wrap {
  width: min(100%, 980px);
  margin-inline: auto;
}

.chat-header {
  margin-bottom: 16px;
}

.eyebrow {
  margin: 0 0 4px;
  color: #66758d;
  font-size: 13px;
  font-weight: 850;
  text-transform: uppercase;
}

.chat-header h1 {
  margin: 0;
  overflow-wrap: anywhere;
  color: #172033;
  font-size: 28px;
  font-weight: 850;
  letter-spacing: 0;
}

.chat-header p {
  margin: 6px 0 0;
  color: #66758d;
}

.message {
  margin-bottom: 12px;
  border-radius: 8px;
  padding: 12px 14px;
  font-size: 14px;
}

.success {
  color: #0f5132;
  background: #dff5e8;
  border: 1px solid #bfe8cf;
}

.error {
  color: #842029;
  background: #fde7e9;
  border: 1px solid #f5c2c7;
}

.chat-panel {
  min-height: 0;
  overflow: auto;
  border: 1px solid #dce5ef;
  border-radius: 8px;
  background: #ffffff;
  box-shadow: 0 18px 50px rgba(31, 45, 61, 0.08);
}

.messages {
  display: grid;
  gap: 18px;
  padding: 24px;
  min-width: 0;
}

.chat-message {
  display: grid;
  grid-template-columns: 40px minmax(0, 1fr);
  gap: 12px;
  align-items: flex-start;
}

.chat-message.user {
  grid-template-columns: minmax(0, 1fr) 40px;
}

.chat-message.user .avatar {
  grid-column: 2;
  grid-row: 1;
}

.chat-message.user .bubble {
  grid-column: 1;
  justify-self: end;
  background: #1f6feb;
  color: #ffffff;
}

.avatar {
  width: 40px;
  height: 40px;
  display: grid;
  place-items: center;
  border-radius: 8px;
  color: #ffffff;
  background: #101827;
  font-size: 12px;
  font-weight: 950;
}

.assistant .avatar {
  background: #16a37f;
}

.bubble {
  max-width: 760px;
  min-width: 0;
  border-radius: 8px;
  padding: 14px 16px;
  color: #172033;
  background: #f3f6fa;
  line-height: 1.6;
  white-space: pre-wrap;
}

.empty-chat {
  min-height: 360px;
  display: grid;
  place-items: center;
  align-content: center;
  gap: 10px;
  color: #66758d;
  text-align: center;
}

.empty-chat strong {
  color: #172033;
  font-size: 18px;
}

.composer-wrap {
  margin-top: 16px;
}

.composer {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: end;
  gap: 10px;
  padding: 12px;
  border: 1px solid #dce5ef;
  border-radius: 14px;
  background: #ffffff;
  box-shadow: 0 18px 50px rgba(31, 45, 61, 0.08);
}

.composer textarea {
  min-height: 48px;
  max-height: 150px;
  resize: vertical;
  border: 0;
  border-radius: 10px;
  padding: 13px 14px;
  color: #172033;
  background: #f8fafc;
  font: inherit;
  line-height: 1.45;
  outline: none;
}

.send-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-width: 92px;
  min-height: 48px;
  border: 0;
  border-radius: 10px;
  padding: 0 18px;
  color: #ffffff;
  background: #1f6feb;
}

.send-button:hover:not(:disabled) {
  background: #175dcc;
}

button:disabled,
textarea:disabled {
  cursor: not-allowed;
  opacity: 0.62;
}

.loader,
.button-loader {
  width: 18px;
  height: 18px;
  border: 3px solid #d8e1ec;
  border-top-color: #1f6feb;
  border-radius: 999px;
  animation: spin 0.8s linear infinite;
}

.button-loader {
  width: 14px;
  height: 14px;
  border-width: 2px;
  border-color: rgba(255, 255, 255, 0.45);
  border-top-color: #ffffff;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 840px) {
  .chat-shell {
    grid-template-columns: 1fr;
    overflow: auto;
  }

  .chat-sidebar {
    height: auto;
  }

  .chat-main {
    height: auto;
    min-height: 100vh;
    overflow: visible;
    padding: 20px;
  }

  .composer {
    grid-template-columns: 1fr;
  }

  .send-button {
    width: 100%;
  }

  .chat-message,
  .chat-message.user {
    grid-template-columns: 34px minmax(0, 1fr);
  }

  .chat-message.user .avatar,
  .chat-message.user .bubble {
    grid-column: auto;
    justify-self: auto;
  }
}
</style>
