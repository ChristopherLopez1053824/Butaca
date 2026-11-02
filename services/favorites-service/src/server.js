import 'dotenv/config';
import app from './app.js';

const PORT = Number(process.env.PORT || 3004);

app.listen(PORT, () => {
  console.log('favorites-service running on port ' + PORT);
});
