import 'dotenv/config';
import app from './app.js';

const PORT = Number(process.env.PORT || 3006);

app.listen(PORT, () => {
  console.log('meme-service running on port ' + PORT);
});
