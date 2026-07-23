<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useChatStore } from '@/stores/chat';
import type { Locale } from '@/types';

const chat = useChatStore();
const route = useRoute();
const input = ref('');
const messageList = ref<HTMLElement>();

async function send() {
  const text = input.value;
  input.value = '';
  await chat.send(text, route.params.locale === 'en' ? 'en' : 'zh');
}

watch(() => chat.messages.map((message) => message.content).join(''), async () => {
  await nextTick();
  messageList.value?.scrollTo({ top: messageList.value.scrollHeight, behavior: 'smooth' });
});
watch(() => chat.open, (open) => { if (open) chat.listSessions(); });
onMounted(() => chat.listSessions());
</script>

<template>
  <t-drawer v-model:visible="chat.open" size="min(720px, 100vw)" :header="$t('chat.title')" :footer="false">
    <div class="chat-layout">
      <aside class="chat-history">
        <div class="chat-history-head">
          <strong>{{ $t('chat.history') }}</strong>
          <t-button size="small" variant="outline" @click="chat.newSession">{{ $t('chat.fresh') }}</t-button>
        </div>
        <button
          v-for="session in chat.sessions"
          :key="session.id"
          class="session-row"
          :class="{ active: session.id === chat.sessionId }"
          @click="chat.openSession(session.id)"
        >
          <span>{{ session.title }}</span>
          <small>{{ new Date(session.updatedAt).toLocaleDateString(route.params.locale as Locale) }}</small>
        </button>
      </aside>
      <section class="chat-main">
        <p class="chat-subtitle">{{ $t('chat.subtitle') }}</p>
        <div ref="messageList" class="messages" aria-live="polite">
          <div v-if="!chat.messages.length" class="chat-empty">{{ $t('chat.empty') }}</div>
          <article v-for="(message, index) in chat.messages" :key="message.id || index" class="message" :class="message.role">
            <div>{{ message.content }}<span v-if="chat.busy && index === chat.messages.length - 1" class="cursor">▋</span></div>
            <details v-for="tool in message.tools" :key="tool.name" class="tool-call">
              <summary>{{ tool.name }}</summary><pre>{{ JSON.stringify(tool.data, null, 2) }}</pre>
            </details>
          </article>
        </div>
        <p v-if="chat.error" class="error-text">{{ chat.error }}</p>
        <form class="chat-composer" @submit.prevent="send">
          <t-textarea v-model="input" :placeholder="$t('chat.placeholder')" :autosize="{ minRows: 2, maxRows: 5 }" @keydown.ctrl.enter="send" />
          <t-button theme="primary" type="submit" :loading="chat.busy" :disabled="!input.trim()">{{ $t('chat.send') }}</t-button>
        </form>
      </section>
    </div>
  </t-drawer>
</template>
