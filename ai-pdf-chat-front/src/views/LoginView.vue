<script setup>
import { ref } from 'vue';
import api from '../api/api';

const emit = defineEmits(['login-success']);

const email = ref('');
const password = ref('');
const isLoading = ref(false);
const successMessage = ref('');
const errorMessage = ref('');

const login = async () => {
  successMessage.value = '';
  errorMessage.value = '';
  isLoading.value = true;

  try {
    const { data } = await api.post('/auth/login', {
      email: email.value,
      password: password.value,
    });

    localStorage.setItem('token', data.access_token);
    successMessage.value = 'Inicio de sesion exitoso.';
    emit('login-success', data.access_token);
  } catch (error) {
    if (!error.response) {
      errorMessage.value =
        'No pudimos conectar con el servidor. Verifica que el backend este encendido.';
      return;
    }

    if (error.response.status === 401) {
      errorMessage.value = 'Email o password incorrectos.';
      return;
    }

    errorMessage.value =
      error.response.data?.message ||
      'No pudimos iniciar sesion. Intenta nuevamente en unos segundos.';
  } finally {
    isLoading.value = false;
  }
};
</script>

<template>
  <main class="login-page">
    <section class="login-card">
      <div class="login-header">
        <h1>Iniciar sesion</h1>
        <p>Accede a tus documentos y continua trabajando.</p>
      </div>

      <form class="login-form" @submit.prevent="login">
        <label class="field">
          <span>Email</span>
          <input
            v-model="email"
            type="email"
            autocomplete="email"
            placeholder="user@example.com"
            required
          />
        </label>

        <label class="field">
          <span>Password</span>
          <input
            v-model="password"
            type="password"
            autocomplete="current-password"
            placeholder="123456"
            required
          />
        </label>

        <button class="login-button" type="submit" :disabled="isLoading">
          {{ isLoading ? 'Iniciando sesion...' : 'Iniciar sesion' }}
        </button>

        <p v-if="successMessage" class="message success">
          {{ successMessage }}
        </p>

        <p v-if="errorMessage" class="message error">
          {{ errorMessage }}
        </p>
      </form>
    </section>
  </main>
</template>

<style scoped>
.login-page {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 24px;
  background:
    radial-gradient(circle at top left, rgba(74, 144, 226, 0.14), transparent 34%),
    linear-gradient(135deg, #f7fafc 0%, #eef3f8 100%);
}

.login-card {
  width: 100%;
  max-width: 420px;
  padding: 32px;
  border: 1px solid #dde6ef;
  border-radius: 8px;
  background: #ffffff;
  box-shadow: 0 20px 60px rgba(31, 45, 61, 0.12);
}

.login-header {
  margin-bottom: 28px;
  text-align: center;
}

.login-header h1 {
  margin: 0 0 8px;
  color: #172033;
  font-size: 28px;
  font-weight: 700;
  letter-spacing: 0;
}

.login-header p {
  margin: 0;
  color: #607089;
  font-size: 15px;
  line-height: 1.5;
}

.login-form {
  display: grid;
  gap: 18px;
}

.field {
  display: grid;
  gap: 8px;
  color: #25324a;
  font-size: 14px;
  font-weight: 600;
}

.field input {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid #ced8e5;
  border-radius: 8px;
  padding: 13px 14px;
  color: #172033;
  background: #fbfdff;
  font: inherit;
  outline: none;
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease,
    background-color 0.2s ease;
}

.field input:focus {
  border-color: #2f80ed;
  background: #ffffff;
  box-shadow: 0 0 0 4px rgba(47, 128, 237, 0.14);
}

.field input::placeholder {
  color: #9aa8ba;
}

.login-button {
  min-height: 48px;
  border: 0;
  border-radius: 8px;
  padding: 0 18px;
  color: #ffffff;
  background: #1f6feb;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
  transition:
    background-color 0.2s ease,
    transform 0.2s ease,
    box-shadow 0.2s ease;
}

.login-button:hover:not(:disabled) {
  background: #175dcc;
  box-shadow: 0 10px 24px rgba(31, 111, 235, 0.24);
  transform: translateY(-1px);
}

.login-button:disabled {
  cursor: not-allowed;
  opacity: 0.68;
}

.message {
  margin: 0;
  border-radius: 8px;
  padding: 12px 14px;
  font-size: 14px;
  line-height: 1.4;
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

@media (max-width: 480px) {
  .login-page {
    padding: 16px;
  }

  .login-card {
    padding: 24px;
  }
}
</style>
