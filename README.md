# 🎮 Flashcard Frenzy Multiplayer

A real-time multiplayer quiz game built with Next.js, Supabase, and MongoDB. Players compete by answering flashcard questions in real-time, with live scoreboard updates and match history tracking.

## ✨ Features

- **Real-time Multiplayer**: Multiple players can join and compete simultaneously
- **Live Scoreboard**: Instant score updates using Supabase Realtime
- **First-Correct Wins**: Only the first correct answer per question earns points
- **Match History**: Permanent storage in MongoDB for game review
- **Responsive Design**: Works on desktop and mobile devices
- **User Authentication**: Secure login system with Supabase Auth

## 🛠 Tech Stack

- **Frontend**: Next.js 15 (App Router), React, TypeScript
- **Styling**: Tailwind CSS, shadcn/ui components
- **Authentication**: Supabase Auth
- **Real-time Database**: Supabase (PostgreSQL)
- **Real-time Updates**: Supabase Realtime
- **Archive Storage**: MongoDB Atlas (with Mongoose)
- **Deployment**: Vercel (recommended)

## 📋 Prerequisites

Before you begin, ensure you have:

- Node.js 18+ installed
- A Supabase account and project
- A MongoDB Atlas account and cluster
- Git installed

## 🚀 Quick Start

### 1. Clone the Repository

```bash
git clone <your-repo-url>
cd flashcard-frenzy-multiplayer
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up Supabase

1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. Go to Settings > API to get your project URL and API keys
3. Go to SQL Editor and run the `supabase-setup.sql` script to create tables and sample data
4. Enable Row Level Security and set up the policies as shown in the setup script

### 4. Set Up MongoDB Atlas

1. Create a MongoDB Atlas account at [mongodb.com](https://www.mongodb.com/atlas)
2. Create a new cluster
3. Create a database user and get your connection string
4. Whitelist your IP address or use 0.0.0.0/0 for development

### 5. Environment Variables

Create a `.env.local` file in the root directory:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# MongoDB
MONGODB_URI=your_mongodb_atlas_connection_string
```

### 6. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## 📊 Database Schema

### Supabase (PostgreSQL)

```sql
-- Game state and real-time updates
matches (id, created_at, current_question)
questions (id, text, correct_answer)
match_questions (id, match_id, question_id, position)
scores (id, match_id, user_id, points)
answers (id, match_id, question_id, user_id, answer, is_correct, created_at)
```

### MongoDB

```javascript
// Permanent game history storage
{
  matchId: "uuid",
  questions: [{ id, text, correct_answer }],
  scores: [{ userId, points }],
  createdAt: "ISO Date"
}
```

## 🎯 How to Play

1. **Sign Up/Login**: Create an account or sign in
2. **Join/Create Match**: Create a new match or join with a Match ID
3. **Answer Questions**: Type your answer and submit quickly
4. **Score Points**: First correct answer gets the point
5. **View Results**: See final rankings and question review
6. **Check History**: Review past matches and performance

## 🏗 Project Structure

```
├── app/                    # Next.js 14 app directory
│   ├── api/               # API routes
│   │   ├── createMatch/
│   │   ├── joinMatch/
│   │   ├── submitAnswer/
│   │   ├── nextQuestion/
│   │   ├── endMatch/
│   │   └── history/
│   ├── lobby/             # Game lobby page
│   ├── login/             # Authentication page
│   ├── match/[id]/        # Game match page
│   │   └── results/       # Match results page
│   └── history/           # Match history page
├── components/ui/         # Reusable UI components
├── lib/                   # Utility libraries
│   ├── supabase.ts        # Supabase client config
│   ├── mongodb.ts         # MongoDB connection
│   └── utils.ts           # Helper functions
└── public/                # Static assets
```

## 🔄 Game Flow

1. **Match Creation**: Host creates match → Questions assigned randomly
2. **Player Joining**: Players join with Match ID → Added to scoreboard
3. **Question Phase**: All players see same question simultaneously
4. **Answer Submission**: Players submit answers → First correct wins point
5. **Live Updates**: Scoreboard updates in real-time via Supabase
6. **Match Progression**: Host advances to next question
7. **Match End**: Final scores saved to MongoDB → Results displayed

## 🚀 Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Connect your repo to Vercel
3. Add environment variables in Vercel dashboard
4. Deploy automatically

### Other Platforms

The app can be deployed on any platform that supports Next.js:

- Netlify
- Railway
- DigitalOcean App Platform
- AWS Amplify

## 🔧 Configuration

### Adding More Questions

Add questions directly to Supabase using the SQL editor:

```sql
INSERT INTO questions (text, correct_answer) VALUES
    ('Your question here?', 'Your answer here');
```

### Customizing Game Rules

- **Questions per match**: Modify limit in `createMatch` API
- **Time per question**: Adjust timer in match page
- **Points per correct answer**: Modify scoring logic in `submitAnswer` API

### Real-time Configuration

Supabase Realtime is configured for:

- `scores` table: Live scoreboard updates
- `matches` table: Question progression updates

## 🐛 Troubleshooting

### Common Issues

1. **Supabase RLS Errors**: Ensure policies are set correctly
2. **MongoDB Connection**: Check connection string and IP whitelist
3. **Real-time Not Working**: Verify Realtime is enabled in Supabase
4. **Build Errors**: Ensure all environment variables are set

### Environment Variables Check

```bash
# Check if variables are loaded
console.log(process.env.NEXT_PUBLIC_SUPABASE_URL)
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Commit changes: `git commit -m 'Add feature'`
4. Push to branch: `git push origin feature-name`
5. Submit a pull request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🎮 Game Features Roadmap

- [ ] Private rooms with passwords
- [ ] Custom question sets
- [ ] Voice chat integration
- [ ] Tournament brackets
- [ ] Player profiles and stats
- [ ] Mobile app (React Native)
- [ ] Admin dashboard for question management

## 📞 Support

If you encounter any issues or have questions:

1. Check the troubleshooting section above
2. Search existing GitHub issues
3. Create a new issue with detailed information
4. Include environment details and error messages

---

**Happy Gaming!** 🎉

Made with ❤️ using Next.js, Supabase, and MongoDB
