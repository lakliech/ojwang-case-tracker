// server.js
const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const session = require('express-session');
const axios = require('axios');
const cors = require('cors');

// Initialize app
const app = express();

// Load env vars
dotenv.config();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: process.env.SESSION_SECRET || 'change_this_secret',
  resave: false,
  saveUninitialized: true
}));

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('✅ MongoDB connected'))
.catch(err => {
  console.error('❌ MongoDB connection error:', err);
  process.exit(1);
});

// Routes
const reportsRouter = require('./routes/reports');
const adminRouter = require('./routes/admin');

app.use('/api/reports', reportsRouter);
app.use('/admin', adminRouter);

// Serve main HTML
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

// X API Configuration
const X_API_CONFIG = {
  baseURL: 'https://api.x.com/2',
  headers: {
    'Authorization': `Bearer ${process.env.X_BEARER_TOKEN}`
  }
};

// Tracked entities for Albert Ojwang case
const TRACKED_ENTITIES = {
  accounts: ['DCI_Kenya', 'ODPP_KE', 'NPSOfficial_KE', 'IPOA_KE'],
  hashtags: ['AlbertOjwang', 'JusticeForAlbert', 'OjwangCase']
};

// Cache setup
let postCache = [];
let lastFetchTime = null;
const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes cache

// Helper function to fetch from X API
async function fetchFromXAPI(endpoint, params = {}) {
  try {
    const response = await axios.get(endpoint, {
      ...X_API_CONFIG,
      params
    });
    return response.data;
  } catch (error) {
    console.error('X API Error:', error.response?.data || error.message);
    throw error;
  }
}

// Enhanced fetch function with error handling
async function fetchPostsWithRetry(fetchFunction, identifier, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fetchFunction(identifier);
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
}

// Fetch posts by account
async function fetchPostsByAccount(account) {
  const { data } = await fetchFromXAPI(`/users/by/username/${account}`);
  const userId = data.id;
  
  const tweets = await fetchFromXAPI(`/users/${userId}/tweets`, {
    'tweet.fields': 'created_at,public_metrics,source,entities',
    'max_results': 15,
    'expansions': 'author_id,attachments.media_keys',
    'user.fields': 'name,username,profile_image_url',
    'media.fields': 'url,preview_image_url,type'
  });

  return tweets.data?.map(tweet => ({
    id: tweet.id,
    text: tweet.text,
    created_at: tweet.created_at,
    metrics: tweet.public_metrics,
    account: {
      name: tweets.includes?.users?.[0]?.name,
      username: tweets.includes?.users?.[0]?.username,
      avatar: tweets.includes?.users?.[0]?.profile_image_url
    },
    media: tweet.attachments?.media_keys?.map(key => 
      tweets.includes?.media?.find(m => m.media_key === key)) || []
  })) || [];
}

// Fetch posts by hashtag
async function fetchPostsByHashtag(hashtag) {
  const tweets = await fetchFromXAPI('/tweets/search/recent', {
    query: `#${hashtag} -is:retweet`,
    'tweet.fields': 'created_at,public_metrics,source,entities',
    'max_results': 15,
    'expansions': 'author_id,attachments.media_keys',
    'user.fields': 'name,username,profile_image_url',
    'media.fields': 'url,preview_image_url,type'
  });

  return tweets.data?.map(tweet => ({
    id: tweet.id,
    text: tweet.text,
    created_at: tweet.created_at,
    metrics: tweet.public_metrics,
    account: {
      name: tweet.includes?.users?.find(u => u.id === tweet.author_id)?.name,
      username: tweet.includes?.users?.find(u => u.id === tweet.author_id)?.username,
      avatar: tweet.includes?.users?.find(u => u.id === tweet.author_id)?.profile_image_url
    },
    media: tweet.attachments?.media_keys?.map(key => 
      tweet.includes?.media?.find(m => m.media_key === key)) || []
  })) || [];
}

// Refresh cache
async function refreshCache() {
  try {
    console.log('Refreshing X post cache...');
    const accountPromises = TRACKED_ENTITIES.accounts.map(account => 
      fetchPostsWithRetry(fetchPostsByAccount, account));
    const hashtagPromises = TRACKED_ENTITIES.hashtags.map(hashtag => 
      fetchPostsWithRetry(fetchPostsByHashtag, hashtag));
    
    const results = await Promise.allSettled([...accountPromises, ...hashtagPromises]);
    postCache = results
      .filter(r => r.status === 'fulfilled')
      .flatMap(r => r.value);
    
    // Deduplicate posts
    postCache = [...new Map(postCache.map(item => [item.id, item])).values()];
    
    // Sort by recency
    postCache.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    
    lastFetchTime = new Date();
    console.log(`Cache refreshed with ${postCache.length} posts`);
  } catch (error) {
    console.error('Error refreshing cache:', error);
  }
}

// API Endpoints
app.get('/api/x-posts', async (req, res) => {
  try {
    // Refresh cache if empty or stale
    if (!postCache.length || (new Date() - lastFetchTime) > CACHE_DURATION) {
      await refreshCache();
    }

    const filter = req.query.filter || 'all';
    let filteredPosts = [...postCache];
    
    if (filter === 'account') {
      filteredPosts = filteredPosts.filter(post => 
        TRACKED_ENTITIES.accounts.includes(post.account.username));
    } else if (filter === 'hashtag') {
      filteredPosts = filteredPosts.filter(post => 
        TRACKED_ENTITIES.hashtags.some(hashtag => 
          post.text.toLowerCase().includes(`#${hashtag.toLowerCase()}`)));
    }

    // Format for frontend
    const formattedPosts = filteredPosts.map(post => ({
      id: post.id,
      name: post.account.name,
      username: post.account.username,
      time: formatTime(post.created_at),
      text: formatPostText(post.text),
      likes: post.metrics.like_count,
      reposts: post.metrics.retweet_count,
      replies: post.metrics.reply_count,
      views: post.metrics.impression_count || estimateViews(post.metrics),
      avatar: post.account.avatar.replace('_normal', '_bigger'),
      media: post.media.map(m => ({
        url: m.url || m.preview_image_url,
        type: m.type
      }))
    }));

    res.json(formattedPosts.slice(0, 50)); // Limit to 50 posts
  } catch (error) {
    console.error('Error fetching posts:', error);
    res.status(500).json({ error: 'Failed to fetch posts' });
  }
});

// Case reports endpoint (existing functionality)
app.get('/api/reports', (req, res) => {
  // Your existing case reports implementation
  res.json([]); // Replace with your actual implementation
});

app.post('/api/reports', (req, res) => {
  // Your existing case reports implementation
  res.json({ success: true }); // Replace with your actual implementation
});

// Helper functions
function formatTime(isoTime) {
  const now = new Date();
  const postTime = new Date(isoTime);
  const diffSeconds = Math.floor((now - postTime) / 1000);
  
  if (diffSeconds < 60) return `${diffSeconds}s ago`;
  if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ago`;
  if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)}h ago`;
  return `${Math.floor(diffSeconds / 86400)}d ago`;
}

function formatPostText(text) {
  // Convert URLs, mentions, and hashtags to clickable links
  return text
    .replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank">$1</a>')
    .replace(/@(\w+)/g, '<a href="https://x.com/$1" target="_blank">@$1</a>')
    .replace(/#(\w+)/g, '<a href="https://x.com/hashtag/$1" target="_blank">#$1</a>');
}

function estimateViews(metrics) {
  // Simple estimation based on engagement metrics
  const base = metrics.like_count * 10 + metrics.retweet_count * 50;
  return base > 1000 ? `${(base / 1000).toFixed(1)}K` : base.toString();
}

// Serve frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
//const PORT = process.env.PORT || 3001;
//app.listen(PORT, async () => {
 // console.log(`Server running on port ${PORT}`);
  // Initial cache refresh
 // await refreshCache();
  // Schedule regular cache refreshes
  //setInterval(refreshCache, CACHE_DURATION);
//});