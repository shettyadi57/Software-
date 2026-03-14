import LoginCard from '../components/LoginCard';
import Navbar from '../components/Navbar';

const ProfessorLogin = () => {
  return (
    <div className="min-h-screen bg-[#050B18] relative">
      <div className="absolute inset-0 grid-bg opacity-30"></div>
      <Navbar />
      <div className="relative z-10 pt-24 flex items-center justify-center px-4">
        <LoginCard role="professor" onLogin={() => {}} />
      </div>
    </div>
  );
};

export default ProfessorLogin;
