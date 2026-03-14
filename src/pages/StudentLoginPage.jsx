import StudentLogin from '../components/StudentLogin';
import Navbar from '../components/Navbar';

const StudentLoginPage = () => {
  return (
    <div className="min-h-screen bg-[#050B18] relative">
      <div className="absolute inset-0 grid-bg opacity-30"></div>
      <Navbar />
      <div className="relative z-10 pt-24">
        <StudentLogin />
      </div>
    </div>
  );
};

export default StudentLoginPage;
