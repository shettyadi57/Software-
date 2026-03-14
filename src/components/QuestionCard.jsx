const QuestionCard = ({ question, selectedOption, onSelect, index }) => {
  return (
    <div className="bg-[#0A1120] rounded-xl p-6 border border-[#00D1FF]/20">
      <p className="text-lg font-medium mb-4">
        <span className="text-[#00D1FF]">Q{index + 1}.</span> {question.question}
      </p>
      <div className="space-y-3">
        {question.options.map((option, optIndex) => (
          <label key={optIndex} className="flex items-center space-x-3 p-3 rounded-lg bg-[#050B18] border border-[#00D1FF]/10 hover:border-[#00D1FF]/40 cursor-pointer transition">
            <input
              type="radio"
              name={`q${question.id}`}
              value={optIndex}
              checked={selectedOption === optIndex}
              onChange={() => onSelect(question.id, optIndex)}
              className="w-4 h-4 text-[#00D1FF] focus:ring-[#00D1FF]"
            />
            <span className="text-gray-300">{String.fromCharCode(65 + optIndex)}. {option}</span>
          </label>
        ))}
      </div>
    </div>
  );
};

export default QuestionCard;
