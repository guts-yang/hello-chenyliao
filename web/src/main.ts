import { createApp } from 'vue';
import { createPinia } from 'pinia';
import TDesign from 'tdesign-vue-next';
import 'tdesign-vue-next/es/style/index.css';
import App from './App.vue';
import router from './router';
import { i18n } from './i18n';
import './styles.css';

createApp(App).use(createPinia()).use(router).use(i18n).use(TDesign).mount('#app');
