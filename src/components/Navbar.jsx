import { Link } from 'react-router-dom';
import { useState } from 'react';

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <nav className="fixed w-full z-50 bg-[#050B18]/80 backdrop-blur-md border-b border-[#00D1FF]/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <Link to="/" className="text-2xl font-bold text-white">
              <span className="text-[#00D1FF] glow-text">AEGIS</span>
            </Link>
          </div>
          <div className="hidden md:flex space-x-8">
            <Link to="/how-it-works" className="text-gray-300 hover:text-[#00D1FF] transition">How it Works</Link>
            <Link to="/features" className="text-gray-300 hover:text-[#00D1FF] transition">Features</Link>
            <Link to="/about" className="text-gray-300 hover:text-[#00D1FF] transition">About</Link>
            <Link to="/login" className="text-gray-300 hover:text-[#00D1FF] transition">Login</Link>
          </div>
          <div className="hidden md:block">
            <Link to="/get-started" className="bg-transparent border border-[#00D1FF] text-[#00D1FF] px-6 py-2 rounded-full hover:bg-[#00D1FF] hover:text-[#050B18] transition-all glow">
              Get Started
            </Link>
          </div>
          <div className="md:hidden">
            <button onClick={() => setIsOpen(!isOpen)} className="text-gray-300">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {isOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>
      </div>
      {isOpen && (
        <div className="md:hidden bg-[#050B18]/95 backdrop-blur-md border-b border-[#00D1FF]/20">
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
            <Link to="/how-it-works" className="block px-3 py-2 text-gray-300 hover:text-[#00D1FF]">How it Works</Link>
            <Link to="/features" className="block px-3 py-2 text-gray-300 hover:text-[#00D1FF]">Features</Link>
            <Link to="/about" className="block px-3 py-2 text-gray-300 hover:text-[#00D1FF]">About</Link>
            <Link to="/login" className="block px-3 py-2 text-gray-300 hover:text-[#00D1FF]">Login</Link>
            <Link to="/get-started" className="block px-3 py-2 text-[#00D1FF] border border-[#00D1FF] rounded-full text-center">Get Started</Link>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
