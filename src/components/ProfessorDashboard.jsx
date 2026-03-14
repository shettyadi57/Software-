import { useState } from 'react';
import { CopyToClipboard } from 'react-copy-to-clipboard';

const ProfessorDashboard = () => {
  const [examTitle, setExamTitle] = useState('');
  const [duration, setDuration] = useState('');
  const [questions, setQuestions] = useState('');
  const [exams, setExams] = useState([
    { id: 'DSA123', name: 'Data Structures Test', duration: 30, questions: 30, link: '/exam/DSA123', status: 'Active' },
    { id: 'ALGO456', name: 'Algorithms Final', duration: 45, questions: 40, link: '/exam/ALGO456', status: 'Active' },
  ]);
  const [copied, setCopied] = useState(false);

  const handleCreateExam = (e) => {
    e.preventDefault();
    const newExam = {
      id: Math.random().toString(36).substring(2, 8).toUpperCase(),
      name: examTitle,
      duration: parseInt(duration),
      questions: parseInt(questions),
      link: `/exam/${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
      status: 'Active',
    };
    setExams([...exams, newExam]);
    setExamTitle('');
    setDuration('');
    setQuestions('');
  };

  return (
    <div className="min-h-screen bg-[#050B18] pt-24 pb-12 px-4">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold mb-8">
          Professor <span className="text-[#00D1FF]">Dashboard</span>
        </h1>

        <div className="bg-[#0A1120] rounded-2xl p-8 border border-[#00D1FF]/20 mb-8">
          <h2 className="text-2xl font-semibold mb-6">Create New Exam</h2>
          <form onSubmit={handleCreateExam} className="grid md:grid-cols-4 gap-4">
            <input
              type="text"
              placeholder="Exam Title"
              value={examTitle}
              onChange={(e) => setExamTitle(e.target.value)}
              className="col-span-2 px-4 py-3 bg-[#050B18] border border-[#00D1FF]/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00D1FF]"
              required
            />
            <input
              type="number"
              placeholder="Duration (min)"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className="px-4 py-3 bg-[#050B18] border border-[#00D1FF]/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00D1FF]"
              required
            />
            <input
              type="number"
              placeholder="# Questions"
              value={questions}
              onChange={(e) => setQuestions(e.target.value)}
              className="px-4 py-3 bg-[#050B18] border border-[#00D1FF]/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00D1FF]"
              required
            />
            <button
              type="submit"
              className="col-span-4 md:col-span-1 py-3 bg-[#00D1FF] text-[#050B18] font-semibold rounded-xl hover:bg-[#00D1FF]/90 transition-all glow"
            >
              Create Exam
            </button>
          </form>
        </div>

        <div className="bg-[#0A1120] rounded-2xl p-8 border border-[#00D1FF]/20">
          <h2 className="text-2xl font-semibold mb-6">Active Exams</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[#00D1FF]/20">
                  <th className="pb-3 font-medium text-gray-400">Exam Name</th>
                  <th className="pb-3 font-medium text-gray-400">Duration</th>
                  <th className="pb-3 font-medium text-gray-400">Questions</th>
                  <th className="pb-3 font-medium text-gray-400">Exam Link</th>
                  <th className="pb-3 font-medium text-gray-400">Status</th>
                </tr>
              </thead>
              <tbody>
                {exams.map((exam) => (
                  <tr key={exam.id} className="border-b border-[#00D1FF]/10">
                    <td className="py-4">{exam.name}</td>
                    <td className="py-4">{exam.duration} min</td>
                    <td className="py-4">{exam.questions}</td>
                    <td className="py-4">
                      <CopyToClipboard text={exam.link} onCopy={() => setCopied(true)}>
                        <button className="text-[#00D1FF] hover:underline">
                          {exam.link} {copied ? '✓' : '📋'}
                        </button>
                      </CopyToClipboard>
                    </td>
                    <td className="py-4">
                      <span className="bg-green-500/20 text-green-400 px-3 py-1 rounded-full text-sm">{exam.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfessorDashboard;
