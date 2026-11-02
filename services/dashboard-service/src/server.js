import 'dotenv/config';
import app from './app.js';

const PORT = Number(process.env.PORT || 3005);

app.listen(PORT, () => {
  console.log('dashboard-service running on port ' + PORT);
});
