import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';

const Landing = () => {
  return (
    <div className="min-h-screen bg-[#050B18] relative overflow-hidden">
      {/* Animated grid background */}
      <div className="absolute inset-0 grid-bg opacity-30"></div>
      {/* Glowing orb */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-[#00D1FF] rounded-full filter blur-3xl opacity-20 animate-pulse"></div>
      
      <Navbar />
      
      <div className="relative z-10 pt-32 pb-16 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="text-5xl md:text-7xl font-bold mb-6">
            Secure <span className="text-[#00D1FF] glow-text">AI-Powered</span><br />
            Online Examination System
          </h1>
          <p className="text-xl text-gray-400 mb-10 max-w-3xl mx-auto">
            Conduct exams with advanced monitoring, credibility scoring, and real-time integrity protection.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/professor/login" className="px-8 py-4 bg-[#00D1FF] text-[#050B18] font-semibold rounded-full hover:bg-[#00D1FF]/90 transition-all glow text-lg">
              Professor Login
            </Link>
            <Link to="/student/login" className="px-8 py-4 bg-transparent border border-[#00D1FF] text-[#00D1FF] font-semibold rounded-full hover:bg-[#00D1FF] hover:text-[#050B18] transition-all glow text-lg">
              Student Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Landing;