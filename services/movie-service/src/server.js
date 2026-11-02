import 'dotenv/config';
import app from './app.js';

const PORT = Number(process.env.PORT || 3003);

app.listen(PORT, () => {
  console.log('movie-service running on port ' + PORT);
});
