<script setup>
import { computed, onMounted, ref } from 'vue';
import api from '../api/api';

const emit = defineEmits(['logout', 'auth-expired']);

const documents = ref([]);
const selectedFile = ref(null);
const isLoading = ref(false);
const isUploading = ref(false);
const isDeleting = ref('');
const selectedDocument = ref(null);
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

    errorMessage.value =
      'No pudimos cargar tus documentos. Intenta nuevamente.';
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

  if (selectedFile.value.type !== 'application/pdf') {
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
    successMessage.value = 'PDF subido correctamente.';
    await loadDocuments();
  } catch (error) {
    if (handleAuthError(error)) return;

    errorMessage.value =
      error.response?.data?.message ||
      'No pudimos subir el PDF. Intenta nuevamente.';
  } finally {
    isUploading.value = false;
  }
};

const deleteDocument = async (documentId) => {
  errorMessage.value = '';
  successMessage.value = '';
  isDeleting.value = documentId;

  try {
    await api.delete(`/documents/${documentId}`);
    successMessage.value = 'Documento eliminado correctamente.';
    await loadDocuments();
  } catch (error) {
    if (handleAuthError(error)) return;

    errorMessage.value =
      'No pudimos eliminar el documento. Intenta nuevamente.';
  } finally {
    isDeleting.value = '';
  }
};

const viewDocument = (document) => {
  selectedDocument.value = document;
};

const logout = () => {
  localStorage.removeItem('token');
  emit('logout');
};

onMounted(loadDocuments);
</script>

<template>
  <main class="documents-page">
    <header class="topbar">
      <div>
        <p class="eyebrow">Biblioteca</p>
        <h1>Mis documentos</h1>
      </div>

      <button class="ghost-button" type="button" @click="logout">
        Cerrar sesion
      </button>
    </header>

    <section class="upload-panel">
      <div class="upload-copy">
        <h2>Subir PDF</h2>
        <p>Agrega documentos PDF de hasta 15 MB.</p>
      </div>

      <form class="upload-form" @submit.prevent="uploadDocument">
        <label class="file-field">
          <span>{{ selectedFile?.name || 'Seleccionar PDF' }}</span>
          <input
            type="file"
            accept="application/pdf,.pdf"
            :disabled="isUploading"
            @change="handleFileChange"
          />
        </label>

        <button class="primary-button" type="submit" :disabled="isUploading">
          {{ isUploading ? 'Subiendo...' : 'Subir PDF' }}
        </button>
      </form>
    </section>

    <p v-if="successMessage" class="message success">{{ successMessage }}</p>
    <p v-if="errorMessage" class="message error">{{ errorMessage }}</p>

    <section class="documents-section">
      <div class="section-header">
        <h2>Documentos cargados</h2>
        <button class="text-button" type="button" :disabled="isLoading" @click="loadDocuments">
          {{ isLoading ? 'Actualizando...' : 'Actualizar' }}
        </button>
      </div>

      <div v-if="isLoading && !hasDocuments" class="empty-state">
        Cargando documentos...
      </div>

      <div v-else-if="!hasDocuments" class="empty-state">
        Todavia no subiste documentos.
      </div>

      <div v-else class="documents-list">
        <article v-for="document in documents" :key="document.id" class="document-row">
          <div class="document-icon">PDF</div>

          <div class="document-info">
            <h3>{{ document.title }}</h3>
            <p>
              {{ formatDate(document.createdAt) }}
              <span v-if="document._count?.chunks">
                · {{ document._count.chunks }} fragmentos
              </span>
            </p>
          </div>

          <div class="document-actions">
            <button class="secondary-button" type="button" @click="viewDocument(document)">
              Ver
            </button>
            <button
              class="danger-button"
              type="button"
              :disabled="isDeleting === document.id"
              @click="deleteDocument(document.id)"
            >
              {{ isDeleting === document.id ? 'Eliminando...' : 'Eliminar' }}
            </button>
          </div>
        </article>
      </div>
    </section>

    <section v-if="selectedDocument" class="detail-panel">
      <div class="detail-card">
        <div class="detail-header">
          <h2>{{ selectedDocument.title }}</h2>
          <button class="text-button" type="button" @click="selectedDocument = null">
            Cerrar
          </button>
        </div>

        <dl>
          <div>
            <dt>Archivo</dt>
            <dd>{{ selectedDocument.filename }}</dd>
          </div>
          <div>
            <dt>Fecha</dt>
            <dd>{{ formatDate(selectedDocument.createdAt) }}</dd>
          </div>
          <div>
            <dt>Fragmentos</dt>
            <dd>{{ selectedDocument._count?.chunks || 0 }}</dd>
          </div>
        </dl>
      </div>
    </section>
  </main>
</template>

<style scoped>
.documents-page {
  min-height: 100vh;
  padding: 32px;
  background: #f4f7fb;
  color: #172033;
  text-align: left;
}

.topbar {
  max-width: 1080px;
  margin: 0 auto 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
}

.eyebrow {
  margin: 0 0 4px;
  color: #66758d;
  font-size: 13px;
  font-weight: 700;
  text-transform: uppercase;
}

.topbar h1 {
  margin: 0;
  color: #172033;
  font-size: 34px;
  font-weight: 800;
  letter-spacing: 0;
}

.upload-panel,
.documents-section,
.detail-panel,
.message {
  max-width: 1080px;
  margin-inline: auto;
}

.upload-panel {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: 20px;
  padding: 24px;
  border: 1px solid #dce5ef;
  border-radius: 8px;
  background: #ffffff;
  box-shadow: 0 16px 45px rgba(31, 45, 61, 0.08);
}

.upload-copy h2,
.documents-section h2 {
  margin: 0 0 6px;
  color: #172033;
  font-size: 20px;
  font-weight: 800;
  letter-spacing: 0;
}

.upload-copy p {
  margin: 0;
  color: #66758d;
  font-size: 15px;
}

.upload-form {
  display: flex;
  align-items: center;
  gap: 12px;
}

.file-field {
  position: relative;
  min-width: 230px;
  max-width: 320px;
  border: 1px dashed #b9c6d6;
  border-radius: 8px;
  padding: 12px 14px;
  color: #435169;
  background: #fbfdff;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
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
.ghost-button,
.text-button {
  border-radius: 8px;
  font: inherit;
  font-size: 14px;
  font-weight: 800;
  cursor: pointer;
  transition:
    background-color 0.2s ease,
    border-color 0.2s ease,
    color 0.2s ease,
    opacity 0.2s ease;
}

.primary-button {
  min-height: 46px;
  border: 0;
  padding: 0 18px;
  color: #ffffff;
  background: #1f6feb;
}

.primary-button:hover:not(:disabled) {
  background: #175dcc;
}

.secondary-button,
.ghost-button {
  min-height: 40px;
  border: 1px solid #cbd6e4;
  padding: 0 14px;
  color: #25324a;
  background: #ffffff;
}

.secondary-button:hover:not(:disabled),
.ghost-button:hover:not(:disabled) {
  border-color: #8fa4bd;
  background: #f8fafc;
}

.danger-button {
  min-height: 40px;
  border: 1px solid #f0b8bf;
  padding: 0 14px;
  color: #9f1d2d;
  background: #fff6f7;
}

.danger-button:hover:not(:disabled) {
  background: #ffe8eb;
}

.text-button {
  border: 0;
  padding: 8px 0;
  color: #1f6feb;
  background: transparent;
}

button:disabled {
  cursor: not-allowed;
  opacity: 0.6;
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

.documents-section {
  margin-top: 24px;
  padding: 24px;
  border: 1px solid #dce5ef;
  border-radius: 8px;
  background: #ffffff;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;
}

.documents-list {
  display: grid;
  gap: 12px;
}

.document-row {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 14px;
  padding: 16px;
  border: 1px solid #e4ebf3;
  border-radius: 8px;
  background: #fbfdff;
}

.document-icon {
  width: 48px;
  height: 48px;
  display: grid;
  place-items: center;
  border-radius: 8px;
  color: #c82032;
  background: #fff0f2;
  font-size: 12px;
  font-weight: 900;
}

.document-info {
  min-width: 0;
}

.document-info h3 {
  margin: 0 0 4px;
  overflow: hidden;
  color: #172033;
  font-size: 16px;
  font-weight: 800;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.document-info p {
  margin: 0;
  color: #66758d;
  font-size: 14px;
}

.document-actions {
  display: flex;
  gap: 8px;
}

.empty-state {
  border: 1px dashed #cbd6e4;
  border-radius: 8px;
  padding: 32px;
  color: #66758d;
  background: #fbfdff;
  text-align: center;
}

.detail-panel {
  margin-top: 24px;
}

.detail-card {
  padding: 24px;
  border: 1px solid #dce5ef;
  border-radius: 8px;
  background: #ffffff;
}

.detail-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}

.detail-header h2 {
  margin: 0;
  overflow-wrap: anywhere;
}

.detail-card dl {
  display: grid;
  gap: 12px;
  margin: 0;
}

.detail-card dl > div {
  display: grid;
  grid-template-columns: 120px 1fr;
  gap: 16px;
  padding-top: 12px;
  border-top: 1px solid #e4ebf3;
}

.detail-card dt {
  color: #66758d;
  font-size: 14px;
  font-weight: 800;
}

.detail-card dd {
  margin: 0;
  color: #172033;
  overflow-wrap: anywhere;
}

@media (max-width: 760px) {
  .documents-page {
    padding: 20px;
  }

  .topbar,
  .upload-panel,
  .section-header,
  .upload-form,
  .document-row,
  .document-actions {
    align-items: stretch;
    grid-template-columns: 1fr;
    flex-direction: column;
  }

  .topbar {
    align-items: flex-start;
  }

  .upload-panel {
    display: grid;
  }

  .upload-form,
  .document-actions {
    display: flex;
  }

  .file-field {
    max-width: none;
  }

  .detail-card dl > div {
    grid-template-columns: 1fr;
    gap: 4px;
  }
}
</style>
