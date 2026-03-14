import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Landing from './pages/Landing';
import ProfessorLogin from './pages/ProfessorLogin';
import StudentLoginPage from './pages/StudentLoginPage';
import ProfessorDashboardPage from './pages/ProfessorDashboardPage';
import ExamPage from './pages/ExamPage';
import ResultPage from './pages/ResultPage';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/professor/login" element={<ProfessorLogin />} />
        <Route path="/student/login" element={<StudentLoginPage />} />
        <Route path="/professor/dashboard" element={<ProfessorDashboardPage />} />
        <Route path="/exam/:examId" element={<StudentLoginPage />} />
        <Route path="/exam/:examId/take" element={<ExamPage />} />
        <Route path="/result" element={<ResultPage />} />
      </Routes>
    </Router>
  );
}

export default App;
