import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const LoginCard = ({ role, onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const handleSubmit = (e) => {
    e.preventDefault();
    onLogin && onLogin({ email, role });
    if (role === 'professor') {
      navigate('/professor/dashboard');
    } else {
      navigate('/exam/demo-exam');
    }
  };

  return (
    <div className="bg-[#0A1120] rounded-2xl p-8 border border-[#00D1FF]/20 shadow-2xl backdrop-blur-sm w-full max-w-md">
      <h2 className="text-3xl font-bold mb-6 text-center">
        <span className="text-[#00D1FF]">{role === 'professor' ? 'Professor' : 'Student'}</span> Login
      </h2>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-3 bg-[#050B18] border border-[#00D1FF]/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00D1FF] text-white"
            placeholder="you@example.com"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Password</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 bg-[#050B18] border border-[#00D1FF]/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00D1FF] text-white"
            placeholder="••••••••"
          />
        </div>
        <button
          type="submit"
          className="w-full py-3 bg-[#00D1FF] text-[#050B18] font-semibold rounded-xl hover:bg-[#00D1FF]/90 transition-all glow"
        >
          Login as {role === 'professor' ? 'Professor' : 'Student'}
        </button>
      </form>
    </div>
  );
};

export default LoginCard;
