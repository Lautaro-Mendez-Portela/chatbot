<script setup>
import { computed, onMounted, ref } from 'vue';
import api from '../api/api';

const emit = defineEmits(['logout', 'auth-expired', 'open-chat']);

const documents = ref([]);
const selectedFile = ref(null);
const fileInput = ref(null);
const isLoading = ref(false);
const isUploading = ref(false);
const isDeleting = ref('');
const errorMessage = ref('');
const successMessage = ref('');

const MAX_PDF_SIZE = 15 * 1024 * 1024;

const hasDocuments = computed(() => documents.value.length > 0);

const formatDate = (date) =>
  new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));

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

  if (error.response.status === 413) {
    return 'El PDF es demasiado grande. El maximo permitido es 15 MB.';
  }

  if (error.response.status === 400) {
    return error.response.data?.message || 'Archivo no permitido. Subi solo PDFs validos.';
  }

  if (error.response.status === 404) {
    return 'Documento no encontrado.';
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

const loadDocuments = async () => {
  isLoading.value = true;
  errorMessage.value = '';

  try {
    const { data } = await api.get('/documents');
    documents.value = data;
  } catch (error) {
    if (handleAuthError(error)) return;
    errorMessage.value = friendlyError(error, 'No pudimos cargar tus documentos.');
  } finally {
    isLoading.value = false;
  }
};

const handleFileChange = (event) => {
  successMessage.value = '';
  errorMessage.value = '';

  const file = event.target.files?.[0];
  selectedFile.value = file || null;
};

const uploadDocument = async () => {
  successMessage.value = '';
  errorMessage.value = '';

  if (!selectedFile.value) {
    errorMessage.value = 'Selecciona un PDF para subir.';
    return;
  }

  if (
    selectedFile.value.type !== 'application/pdf' ||
    !selectedFile.value.name.toLowerCase().endsWith('.pdf')
  ) {
    errorMessage.value = 'Solo se permiten archivos PDF.';
    return;
  }

  if (selectedFile.value.size > MAX_PDF_SIZE) {
    errorMessage.value = 'El PDF no puede pesar mas de 15 MB.';
    return;
  }

  const formData = new FormData();
  formData.append('file', selectedFile.value);
  isUploading.value = true;

  try {
    await api.post('/documents/upload', formData);
    selectedFile.value = null;

    if (fileInput.value) {
      fileInput.value.value = '';
    }

    successMessage.value = 'PDF subido correctamente.';
    await loadDocuments();
  } catch (error) {
    if (handleAuthError(error)) return;
    errorMessage.value = friendlyError(error, 'No pudimos subir el PDF.');
  } finally {
    isUploading.value = false;
  }
};

const deleteDocument = async (document) => {
  const confirmed = window.confirm(
    `Seguro que queres eliminar "${document.title}"? Esta accion no se puede deshacer.`,
  );

  if (!confirmed) return;

  errorMessage.value = '';
  successMessage.value = '';
  isDeleting.value = document.id;

  try {
    await api.delete(`/documents/${document.id}`);
    successMessage.value = 'Documento eliminado correctamente.';
    await loadDocuments();
  } catch (error) {
    if (handleAuthError(error)) return;
    errorMessage.value = friendlyError(error, 'No pudimos eliminar el documento.');
  } finally {
    isDeleting.value = '';
  }
};

const logout = () => {
  localStorage.removeItem('token');
  emit('logout');
};

onMounted(loadDocuments);
</script>

<template>
  <main class="app-shell">
    <aside class="sidebar">
      <div class="brand">
        <div class="brand-mark">AI</div>
        <div>
          <strong>ChatPDF</strong>
          <span>{{ userEmail }}</span>
        </div>
      </div>

      <button class="nav-button active" type="button">Mis documentos</button>

      <div class="sidebar-documents">
        <button
          v-for="document in documents"
          :key="document.id"
          class="sidebar-document"
          type="button"
          @click="emit('open-chat', document.id)"
        >
          <span>PDF</span>
          <strong>{{ document.title }}</strong>
        </button>

        <p v-if="!isLoading && !hasDocuments" class="sidebar-empty">
          Sin documentos todavia
        </p>
      </div>

      <button class="nav-button" type="button" @click="loadDocuments">Actualizar</button>

      <div class="sidebar-footer">
        <button class="ghost-button full" type="button" @click="logout">
          Cerrar sesion
        </button>
      </div>
    </aside>

    <section class="content">
      <header class="page-header">
        <div>
          <p class="eyebrow">Biblioteca</p>
          <h1>Mis documentos</h1>
          <p>Subi PDFs, abri un chat y pregunta sobre su contenido.</p>
        </div>
      </header>

      <section class="upload-panel">
        <div>
          <h2>Subir PDF</h2>
          <p>Archivos PDF de hasta 15 MB.</p>
        </div>

        <form class="upload-form" @submit.prevent="uploadDocument">
          <label class="file-field">
            <span>{{ selectedFile?.name || 'Seleccionar PDF' }}</span>
            <input
              ref="fileInput"
              type="file"
              accept="application/pdf,.pdf"
              :disabled="isUploading"
              @change="handleFileChange"
            />
          </label>

          <button class="primary-button" type="submit" :disabled="isUploading">
            <span v-if="isUploading" class="button-loader"></span>
            {{ isUploading ? 'Subiendo...' : 'Subir PDF' }}
          </button>
        </form>
      </section>

      <p v-if="successMessage" class="message success">{{ successMessage }}</p>
      <p v-if="errorMessage" class="message error">{{ errorMessage }}</p>

      <section class="documents-panel">
        <div class="section-header">
          <h2>Documentos cargados</h2>
          <span>{{ documents.length }} documentos</span>
        </div>

        <div v-if="isLoading && !hasDocuments" class="empty-state">
          <span class="loader"></span>
          Cargando documentos...
        </div>

        <div v-else-if="!hasDocuments" class="empty-state">
          <strong>Todavia no subiste documentos.</strong>
          <span>Cuando subas un PDF, va a aparecer aca listo para chatear.</span>
        </div>

        <div v-else class="documents-list">
          <article v-for="document in documents" :key="document.id" class="document-row">
            <button class="document-main" type="button" @click="emit('open-chat', document.id)">
              <span class="document-icon">PDF</span>
              <span class="document-info">
                <strong>{{ document.title }}</strong>
                <small>
                  {{ formatDate(document.createdAt) }}
                  <span v-if="document._count?.chunks">
                    - {{ document._count.chunks }} fragmentos
                  </span>
                </small>
              </span>
            </button>

            <div class="document-actions">
              <button class="secondary-button" type="button" @click="emit('open-chat', document.id)">
                Abrir chat
              </button>
              <button
                class="danger-button"
                type="button"
                :disabled="isDeleting === document.id"
                @click="deleteDocument(document)"
              >
                {{ isDeleting === document.id ? 'Eliminando...' : 'Eliminar' }}
              </button>
            </div>
          </article>
        </div>
      </section>
    </section>
  </main>
</template>

<style scoped>
.app-shell {
  width: 100%;
  height: 100dvh;
  display: grid;
  grid-template-columns: 280px 1fr;
  overflow: hidden;
  background: #eef2f7;
  color: #172033;
}

.sidebar {
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
.ghost-button {
  min-height: 42px;
  border: 1px solid transparent;
  border-radius: 8px;
  padding: 0 14px;
  font: inherit;
  font-weight: 800;
  cursor: pointer;
}

.nav-button {
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
  max-height: 280px;
  overflow: auto;
  padding-right: 2px;
}

.sidebar-document {
  min-width: 0;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
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

.sidebar-document:hover {
  background: #1b2638;
}

.sidebar-document span {
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

.sidebar-empty {
  margin: 4px 10px;
  color: #8fa0b8;
  font-size: 13px;
}

.sidebar-footer {
  margin-top: auto;
}

.full {
  width: 100%;
}

.content {
  min-width: 0;
  height: 100dvh;
  display: grid;
  grid-template-rows: auto auto auto minmax(0, 1fr);
  overflow: hidden;
  padding: 32px;
}

.page-header,
.upload-panel,
.documents-panel,
.message {
  max-width: 1120px;
  margin-inline: auto;
}

.page-header {
  margin-bottom: 24px;
}

.eyebrow {
  margin: 0 0 4px;
  color: #66758d;
  font-size: 13px;
  font-weight: 800;
  text-transform: uppercase;
}

.page-header h1 {
  margin: 0;
  color: #172033;
  font-size: 36px;
  font-weight: 850;
  letter-spacing: 0;
}

.page-header p,
.upload-panel p {
  margin: 6px 0 0;
  color: #66758d;
}

.upload-panel,
.documents-panel {
  border: 1px solid #dce5ef;
  border-radius: 8px;
  background: #ffffff;
  box-shadow: 0 18px 50px rgba(31, 45, 61, 0.08);
}

.upload-panel {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: 20px;
  padding: 24px;
}

.upload-panel h2,
.documents-panel h2 {
  margin: 0;
  color: #172033;
  font-size: 20px;
  font-weight: 850;
}

.upload-form {
  display: flex;
  gap: 12px;
}

.file-field {
  position: relative;
  min-width: 240px;
  max-width: 340px;
  border: 1px dashed #aebbd0;
  border-radius: 8px;
  padding: 12px 14px;
  color: #435169;
  background: #fbfdff;
  font-weight: 800;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-field input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}

.primary-button,
.secondary-button,
.danger-button,
.ghost-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 42px;
  border-radius: 8px;
  padding: 0 14px;
  font: inherit;
  font-size: 14px;
  font-weight: 850;
  cursor: pointer;
}

.primary-button {
  border: 0;
  color: #ffffff;
  background: #1f6feb;
}

.primary-button:hover:not(:disabled) {
  background: #175dcc;
}

.secondary-button,
.ghost-button {
  border: 1px solid #cbd6e4;
  color: #25324a;
  background: #ffffff;
}

.ghost-button {
  color: #d7e2f2;
  border-color: #34445e;
  background: #162235;
}

.danger-button {
  border: 1px solid #f0b8bf;
  color: #9f1d2d;
  background: #fff6f7;
}

button:disabled {
  cursor: not-allowed;
  opacity: 0.62;
}

.message {
  margin-top: 16px;
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

.documents-panel {
  min-height: 0;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  margin-top: 24px;
  padding: 24px;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;
}

.section-header span {
  color: #66758d;
  font-size: 14px;
  font-weight: 800;
}

.documents-list {
  min-height: 0;
  display: grid;
  gap: 12px;
  overflow: auto;
  padding-right: 4px;
}

.document-row {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 14px;
  align-items: center;
  padding: 14px;
  border: 1px solid #e4ebf3;
  border-radius: 8px;
  background: #fbfdff;
}

.document-main {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 14px;
  border: 0;
  padding: 0;
  background: transparent;
  text-align: left;
  cursor: pointer;
}

.document-icon {
  width: 48px;
  height: 48px;
  display: grid;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 8px;
  color: #c82032;
  background: #fff0f2;
  font-size: 12px;
  font-weight: 950;
}

.document-info {
  min-width: 0;
  display: grid;
  gap: 4px;
}

.document-info strong {
  overflow: hidden;
  color: #172033;
  font-size: 16px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.document-info small {
  color: #66758d;
  font-size: 14px;
}

.document-actions {
  display: flex;
  gap: 8px;
}

.empty-state {
  display: grid;
  place-items: center;
  gap: 8px;
  min-height: 160px;
  border: 1px dashed #cbd6e4;
  border-radius: 8px;
  padding: 28px;
  color: #66758d;
  background: #fbfdff;
  text-align: center;
}

.empty-state strong {
  color: #172033;
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
  .app-shell {
    grid-template-columns: 1fr;
    overflow: auto;
  }

  .sidebar {
    height: auto;
  }

  .content {
    height: auto;
    overflow: visible;
    padding: 20px;
  }

  .upload-panel,
  .upload-form,
  .document-row,
  .document-actions {
    grid-template-columns: 1fr;
    flex-direction: column;
    align-items: stretch;
  }

  .file-field {
    max-width: none;
  }
}
</style>
