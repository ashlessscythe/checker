# 🕰️ Checker

## Real-time Check-In/Check-Out System for Small Businesses 🏢

Checker is a modern, efficient solution for managing employee attendance and time tracking. Built with cutting-edge technologies, it offers real-time updates and seamless scalability for growing businesses.

### ✨ Key Features

- 🔄 Real-time updates - no need to refresh!
- 🚀 Easily scalable for businesses of all sizes
- 🔐 Secure user authentication
- 🏢 Department management and user-department linking
- ⏰ Automatic check-out after configurable periods
- 🤖 System-generated check-ins for data population
- 🎨 Customizable through environment variables

### 🛠️ Technologies Used

- Next.js
- React
- InstantDB
- Deployment platform of choice: (Render/Vercel/Netlify/Heroku) etc.

### 🚀 Getting Started

1. Clone the repository:

```
git clone https://github.com/ashlessscythe/checker.git
```

2. Install dependencies:

```
cd checker
npm install
```

3. Set up your environment variables:

- Rename `.env.example` to `.env.local`
- Update the variables as needed:
  ```
  NEXT_PUBLIC_INSTANT_APP_ID=your_instant_app_id
  NEXT_PUBLIC_THRESHOLD_HOURS=14
  NEXT_PUBLIC_ENABLE_AUTO_CLEANUP=false
  NEXT_PUBLIC_STALE_CHECKIN_CLEANUP_HOURS=18
  NEXT_PUBLIC_CLEANUP_INTERVAL_MINUTES=20
  ```

4. Run the development server:

```
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser to see the app in action!

### 🌐 Deployment

Make sure to set your InstantDB URL in your deployment environment settings.

### 🤝 Contributing

We welcome contributions! If you'd like to contribute:

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

Please ensure your code adheres to the project's coding standards and includes appropriate tests.

### 📄 License

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details.

---

Built with ❤️ by Some dude
