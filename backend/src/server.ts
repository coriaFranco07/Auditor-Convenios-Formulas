import { appConfig } from './config/app-config';
import { createApp } from './app';

const app = createApp();

app.listen(appConfig.port, () => {
  // eslint-disable-next-line no-console
  console.log(`Backend escuchando en http://localhost:${appConfig.port}`);
});

