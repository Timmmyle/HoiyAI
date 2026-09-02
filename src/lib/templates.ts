export interface SurveyTemplate {
  id: string;
  name: string;
  category: 'edu' | 'student' | 'event' | 'business';
  badge: string;
  targetAudience: string;
  shortDesc: string;
  fullIntro: string;
  questionCount: number;
  isQuiz: boolean;
  learningSettings?: any;
  questions: any[];
}

export const TEMPLATES_DATA: SurveyTemplate[] = [
  // 1. GIẢNG VIÊN - BÀI KIỂM TRA 15 PHÚT (EDU #1)
  {
    id: 'quiz-15m',
    name: 'Bài kiểm tra 15 phút (Có bấm giờ)',
    category: 'edu',
    badge: '🎓 Dành cho Giảng viên & Giáo viên',
    targetAudience: 'Giáo viên K12, Giảng viên Đại học, Trợ giảng',
    shortDesc: 'Bài test trắc nghiệm 20 câu đếm ngược 15p & đảo câu hỏi',
    fullIntro: 'Mẫu bài kiểm tra trắc nghiệm 20 câu hỏi kiến thức tổng hợp dành cho học sinh/sinh viên. Bài thi được tích hợp sẵn đồng hồ đếm ngược (15 phút), thang điểm 100 tự động, và tính năng xáo trộn câu hỏi/đáp án chống gian lận.',
    questionCount: 20,
    isQuiz: true,
    learningSettings: { timer_type: 'total', timer_value: 15, points_per_question: 5, shuffle_questions: true, shuffle_answers: true },
    questions: [
      { type: 'text', text: 'HƯỚNG DẪN BÀI THI: Bài kiểm tra trắc nghiệm gồm 20 câu hỏi. Thời gian làm bài là 15 phút. Hệ thống tự động đếm ngược và nộp bài khi hết giờ.' },
      { type: 'radio', text: 'Câu 1: Thủ đô của Việt Nam là thành phố nào?', options: ['Hà Nội', 'TP. Hồ Chí Minh', 'Đà Nẵng', 'Cần Thơ'], correct_answer: 'Hà Nội', explanation: 'Hà Nội là thủ đô của Nước Cộng hòa Xã hội Chủ nghĩa Việt Nam.' },
      { type: 'radio', text: 'Câu 2: Thành phần chiếm tỷ lệ thể tích lớn nhất trong không khí là khí nào?', options: ['Nitơ (N2)', 'Oxi (O2)', 'Cacbonic (CO2)', 'Heli (He)'], correct_answer: 'Nitơ (N2)', explanation: 'Khí Nitơ chiếm khoảng 78% thể tích không khí.' },
      { type: 'radio', text: 'Câu 3: Thuật ngữ "AI" trong công nghệ là viết tắt của từ nào?', options: ['Artificial Intelligence', 'Automated Information', 'Advanced Integration', 'Application Interface'], correct_answer: 'Artificial Intelligence', explanation: 'AI viết tắt của Artificial Intelligence.' },
      { type: 'radio', text: 'Câu 4: Nước nào có diện tích tự nhiên lớn nhất thế giới?', options: ['Nga', 'Canada', 'Trung Quốc', 'Mỹ'], correct_answer: 'Nga', explanation: 'Nga có diện tích lớn nhất (~17.1 triệu km²).' },
      { type: 'radio', text: 'Câu 5: Phương trình x² - 9 = 0 có tập nghiệm là:', options: ['x = ±3', 'x = 3', 'x = 9', 'Vô nghiệm'], correct_answer: 'x = ±3', explanation: 'x² = 9 => x = ±3.' },
      { type: 'radio', text: 'Câu 6: Đơn vị đo cường độ dòng điện trong hệ SI là gì?', options: ['Ampe (A)', 'Volt (V)', 'Watt (W)', 'Ohm (Ω)'], correct_answer: 'Ampe (A)', explanation: 'Cường độ dòng điện đo bằng Ampe.' },
      { type: 'radio', text: 'Câu 7: Tác giả của tác phẩm "Bình Ngô Đại Cáo" là ai?', options: ['Nguyễn Trãi', 'Nguyễn Du', 'Trịnh Hoài Đức', 'Lê Thánh Tông'], correct_answer: 'Nguyễn Trãi', explanation: 'Nguyễn Trãi soạn Bình Ngô Đại Cáo năm 1428.' },
      { type: 'radio', text: 'Câu 8: Loài động vật có vú duy nhất có khả năng bay thực sự là:', options: ['Dơi', 'Sóc bay', 'Chim bói cá', 'Đại bàng'], correct_answer: 'Dơi', explanation: 'Dơi là loài thú duy nhất biết bay.' },
      { type: 'radio', text: 'Câu 9: Hành tinh nào gần Mặt Trời nhất trong Hệ Mặt Trời?', options: ['Sao Thủy', 'Sao Kim', 'Trái Đất', 'Sao Hỏa'], correct_answer: 'Sao Thủy', explanation: 'Sao Thủy (Mercury) gần Mặt Trời nhất.' },
      { type: 'radio', text: 'Câu 10: Đại dương nào có diện tích lớn nhất trên Trái Đất?', options: ['Thái Bình Dương', 'Đại Tây Dương', 'Ấn Độ Dương', 'Bắc Băng Dương'], correct_answer: 'Thái Bình Dương', explanation: 'Thái Bình Dương rộng nhất chiếm ~30% diện tích Trái Đất.' },
      { type: 'radio', text: 'Câu 11: Trong Tiếng Anh, từ nào đồng nghĩa với "Smart"?', options: ['Intelligent', 'Slow', 'Weak', 'Sad'], correct_answer: 'Intelligent', explanation: 'Smart và Intelligent đều nghĩa là thông minh.' },
      { type: 'radio', text: 'Câu 12: Nguyên tố hóa học nào có ký hiệu là "Fe"?', options: ['Sắt', 'Vàng', 'Bạc', 'Đồng'], correct_answer: 'Sắt', explanation: 'Fe bắt nguồn từ tiếng Latin Ferrum (Sắt).' },
      { type: 'radio', text: 'Câu 13: Một năm nhuận theo lịch Dương có bao nhiêu ngày?', options: ['366 ngày', '365 ngày', '364 ngày', '360 ngày'], correct_answer: '366 ngày', explanation: 'Năm nhuận thêm ngày 29/2 nên có 366 ngày.' },
      { type: 'radio', text: 'Câu 14: Cơ quan nào trong cơ thể đóng vai trò lọc máu chính?', options: ['Thận', 'Gan', 'Tim', 'Phổi'], correct_answer: 'Thận', explanation: 'Thận lọc máu bài tiết nước tiểu.' },
      { type: 'radio', text: 'Câu 15: Ai là nhà sáng lập tập đoàn Microsoft?', options: ['Bill Gates', 'Steve Jobs', 'Mark Zuckerberg', 'Elon Musk'], correct_answer: 'Bill Gates', explanation: 'Bill Gates cùng Paul Allen sáng lập Microsoft năm 1975.' },
      { type: 'radio', text: 'Câu 16: Con sông nào dài nhất thế giới?', options: ['Sông Nile', 'Sông Amazon', 'Sông Mê Kông', 'Sông Dương Tử'], correct_answer: 'Sông Nile', explanation: 'Sông Nile ở Châu Phi dài nhất (~6650 km).' },
      { type: 'radio', text: 'Câu 17: Số tiếp theo trong dãy 2, 4, 8, 16, ... là:', options: ['32', '24', '30', '64'], correct_answer: '32', explanation: 'Dãy cấp số nhân nhân 2: 16 x 2 = 32.' },
      { type: 'radio', text: 'Câu 18: Kim loại nào dẫn điện tốt nhất?', options: ['Bạc (Ag)', 'Đồng (Cu)', 'Vàng (Au)', 'Nhôm (Al)'], correct_answer: 'Bạc (Ag)', explanation: 'Bạc dẫn điện tốt nhất trong các kim loại.' },
      { type: 'radio', text: 'Câu 19: Thành phố nào là trung tâm kinh tế lớn nhất miền Nam Việt Nam?', options: ['TP. Hồ Chí Minh', 'Cần Thơ', 'Biên Hòa', 'Vũng Tàu'], correct_answer: 'TP. Hồ Chí Minh', explanation: 'TP.HCM là trung tâm kinh tế lớn nhất.' },
      { type: 'radio', text: 'Câu 20: Ứng dụng ChatGPT được phát triển bởi công ty công nghệ nào?', options: ['OpenAI', 'Google', 'Meta', 'Microsoft'], correct_answer: 'OpenAI', explanation: 'OpenAI ra mắt ChatGPT vào tháng 11/2022.' }
    ]
  },

  // 2. GIẢNG VIÊN - KHẢO SÁT ĐÁNH GIÁ MÔN HỌC (EDU #2)
  {
    id: 'course-eval',
    name: 'Khảo sát Đánh giá Môn học',
    category: 'edu',
    badge: '🎓 Dành cho Giảng viên & Ban Giám Hiệu',
    targetAudience: 'Giảng viên Đại học, Ban Khảo thí & Đảm bảo chất lượng',
    shortDesc: 'Đánh giá giảng viên, bài giảng, tài liệu & cơ sở vật chất',
    fullIntro: 'Bảng khảo sát 20 câu dành cho Giảng viên & Nhà trường thu thập ý kiến phản hồi ẩn danh của sinh viên về chất lượng bài giảng, tài liệu, phương pháp sư phạm, thi cử và cơ sở vật chất phòng học.',
    questionCount: 20,
    isQuiz: false,
    questions: [
      { type: 'text', text: 'GIỚI THIỆU KHẢO SÁT: Khảo sát nhằm nâng cao chất lượng giảng dạy. Mọi ý kiến phản hồi của sinh viên đều hoàn toàn ẩn danh và bảo mật.' },
      { type: 'radio', text: 'Câu 1: Bạn hiện đang là sinh viên năm thứ mấy?', options: ['Năm thứ nhất', 'Năm thứ hai', 'Năm thứ ba', 'Năm thứ tư / Học viên'] },
      { type: 'scale', text: 'Câu 2: Đánh giá mức độ hài lòng tổng thể của bạn về môn học này (1 - Rất kém, 5 - Rất tốt)' },
      { type: 'scale', text: 'Câu 3: Nội dung môn học bám sát đề cương chi tiết và đáp ứng mục tiêu đề ra (1-5)' },
      { type: 'scale', text: 'Câu 4: Giảng viên truyền đạt kiến thức rõ ràng, mạch lạc và dễ tiếp thu (1-5)' },
      { type: 'scale', text: 'Câu 5: Bài giảng được chuẩn bị chu đáo, có hình ảnh / ví dụ thực tế phong phú (1-5)' },
      { type: 'scale', text: 'Câu 6: Giảng viên luôn lên lớp đúng giờ và đảm bảo đủ thời lượng học phần (1-5)' },
      { type: 'scale', text: 'Câu 7: Giảng viên nhiệt tình giải đáp các thắc mắc của sinh viên trong và ngoài giờ học (1-5)' },
      { type: 'scale', text: 'Câu 8: Giáo trình và tài liệu tham khảo được cung cấp kịp thời, dễ truy cập (1-5)' },
      { type: 'scale', text: 'Câu 9: Khối lượng bài tập cá nhân và bài tập nhóm phù hợp với thời lượng học phần (1-5)' },
      { type: 'scale', text: 'Câu 10: Phương pháp đánh giá điểm số (chuyên cần, giữa kỳ, bài tập lớn) công bằng và minh bạch (1-5)' },
      { type: 'checkbox', text: 'Câu 11: Những phương pháp giảng dạy bạn thấy hiệu quả nhất? (Chọn nhiều)', options: ['Thảo luận nhóm', 'Phân tích tình huống thực tế (Case study)', 'Thực hành máy tính / Lab', 'Thuyết trình cá nhân', 'Game tương tác & Quiz'] },
      { type: 'scale', text: 'Câu 12: Trang thiết bị phòng học (máy chiếu, âm thanh, điều hòa) đáp ứng tốt nhu cầu học tập (1-5)' },
      { type: 'radio', text: 'Câu 13: Tần suất giảng viên ứng dụng công nghệ (LMS, AI, Quiz online) trong buổi học:', options: ['Thường xuyên mỗi buổi', 'Thỉnh thoảng', 'Hiếm khi / Không dùng'] },
      { type: 'scale', text: 'Câu 14: Mức độ đi học chuyên cần và chuẩn bị bài trước của bản thân bạn (1-5)' },
      { type: 'scale', text: 'Câu 15: Kiến thức môn học có giá trị ứng dụng cao cho công việc thực tế tương lai (1-5)' },
      { type: 'checkbox', text: 'Câu 16: Khó khăn lớn nhất bạn gặp phải khi học môn này (Chọn nhiều):', options: ['Tài liệu tiếng Anh khó đọc', 'Khối lượng kiến thức quá lớn', 'Thiếu thời gian thực hành', 'Tốc độ giảng quá nhanh'] },
      { type: 'scale', text: 'Câu 17: Tốc độ giảng dạy của giảng viên (1 - Quá chậm, 5 - Quá nhanh)' },
      { type: 'radio', text: 'Câu 18: Bạn có mong muốn tiếp tục đăng ký các môn học khác do giảng viên này dạy không?', options: ['Có, chắc chắn', 'Phụ thuộc môn học', 'Không'] },
      { type: 'textarea', text: 'Câu 19: Nêu những ưu điểm nổi bật nhất của giảng viên / môn học này' },
      { type: 'textarea', text: 'Câu 20: Đề xuất đóng góp cụ thể để nhà trường hoàn thiện môn học tốt hơn trong học kỳ sau' }
    ]
  },

  // 3. SINH VIÊN - KHẢO SÁT NCKH / LUẬN VĂN (STUDENT #1)
  {
    id: 'thesis-survey',
    name: 'Khảo sát Nghiên cứu NCKH / Luận văn',
    category: 'student',
    badge: '📚 Dành cho Sinh viên Làm NCKH & Luận Văn',
    targetAudience: 'Sinh viên làm NCKH, Khóa luận tốt nghiệp, Học viên Cao học',
    shortDesc: 'Mẫu thang đo Likert phục vụ xử lý số liệu SPSS / Excel',
    fullIntro: 'Mẫu 20 câu hỏi nghiên cứu khoa học tiêu chuẩn theo thang đo Likert (1-5), giúp sinh viên dễ dàng thu thập mẫu khảo sát chạy mô hình tương quan, hồi quy SPSS / SmartPLS cho đề tài tốt nghiệp.',
    questionCount: 20,
    isQuiz: false,
    questions: [
      { type: 'text', text: 'GIỚI THIỆU ĐỀ TÀI: Bảng khảo sát phục vụ Đề tài Nghiên cứu Khoa học về Các yếu tố ảnh hưởng đến Ý định sử dụng dịch vụ thông minh. Rất mong bạn dành 3 phút thực hiện.' },
      { type: 'radio', text: 'Câu 1: Độ tuổi của bạn:', options: ['Dưới 18 tuổi', '18 - 22 tuổi', '23 - 30 tuổi', 'Trên 30 tuổi'] },
      { type: 'radio', text: 'Câu 2: Giới tính:', options: ['Nam', 'Nữ', 'Khác / Không tiết lộ'] },
      { type: 'radio', text: 'Câu 3: Nghề nghiệp hiện tại:', options: ['Học sinh / Sinh viên', 'Nhân viên văn phòng', 'Kinh doanh tự do', 'Khác'] },
      { type: 'radio', text: 'Câu 4: Mức thu nhập / Chi tiêu hàng tháng:', options: ['Dưới 3 triệu', '3 - 7 triệu', '7 - 15 triệu', 'Trên 15 triệu'] },
      { type: 'scale', text: 'Câu 5: [PU1] Dịch vụ giúp tôi nâng cao hiệu quả làm việc / học tập hàng ngày (1 - Rất không đồng ý, 5 - Rất đồng ý)' },
      { type: 'scale', text: 'Câu 6: [PU2] Việc sử dụng dịch vụ giúp tôi hoàn thành công việc nhanh chóng hơn (1-5)' },
      { type: 'scale', text: 'Câu 7: [PU3] Dịch vụ đáp ứng tốt các nhu cầu học tập và tìm kiếm thông tin của tôi (1-5)' },
      { type: 'scale', text: 'Câu 8: [PEOU1] Thao tác sử dụng dịch vụ rất đơn giản và dễ học (1-5)' },
      { type: 'scale', text: 'Câu 9: [PEOU2] Giao diện ứng dụng rõ ràng, các nút bấm bố trí hợp lý (1-5)' },
      { type: 'scale', text: 'Câu 10: [PEOU3] Tôi không gặp khó khăn khi tìm kiếm thông tin trên ứng dụng (1-5)' },
      { type: 'scale', text: 'Câu 11: [SEC1] Thông tin cá nhân của tôi được bảo mật an toàn (1-5)' },
      { type: 'scale', text: 'Câu 12: [SEC2] Các giao dịch trên ứng dụng đem lại cho tôi sự tin tưởng (1-5)' },
      { type: 'scale', text: 'Câu 13: [SN1] Những người xung quanh (bạn bè, thầy cô) khuyên tôi nên sử dụng dịch vụ này (1-5)' },
      { type: 'scale', text: 'Câu 14: [SN2] Tôi sử dụng dịch vụ vì thấy xu hướng phổ biến trong giới trẻ (1-5)' },
      { type: 'scale', text: 'Câu 15: [SAT1] Nhìn chung, tôi cảm thấy rất hài lòng với chất lượng dịch vụ (1-5)' },
      { type: 'scale', text: 'Câu 16: [SAT2] Dịch vụ vượt ngoài sự mong đợi ban đầu của tôi (1-5)' },
      { type: 'scale', text: 'Câu 17: [BI1] Tôi có ý định tiếp tục sử dụng dịch vụ trong 6 tháng tới (1-5)' },
      { type: 'scale', text: 'Câu 18: [BI2] Tôi sẵn sàng giới thiệu dịch vụ này cho người thân và bạn bè (1-5)' },
      { type: 'checkbox', text: 'Câu 19: Kênh thông tin giúp bạn biết đến dịch vụ (Chọn nhiều):', options: ['Facebook/TikTok', 'Bạn bè giới thiệu', 'Quảng cáo Google', 'Bài báo / Diễn đàn'] },
      { type: 'textarea', text: 'Câu 20: Đóng góp ý kiến thêm của bạn để hoàn thiện đề tài nghiên cứu' }
    ]
  },

  // 4. SINH VIÊN - ÔN TẬP FLASHCARD & QUIZ (STUDENT #2)
  {
    id: 'flashcard-quiz',
    name: 'Ôn tập Flashcard & Quiz',
    category: 'student',
    badge: '📚 Dành cho Sinh viên Ôn Thi & Học Nhóm',
    targetAudience: 'Học sinh, Sinh viên ôn thi giữa kỳ / cuối kỳ, Ôn tiếng Anh',
    shortDesc: 'Ôn thi trắc nghiệm tiếng Anh & lý thuyết có giải thích chi tiết',
    fullIntro: 'Bộ 20 câu trắc nghiệm luyện tập kiến thức tổng hợp và ngoại ngữ. Tích hợp sẵn chế độ Practice Mode giúp hiển thị ngay đáp án đúng và lời giải thích chi tiết sau mỗi câu chọn.',
    questionCount: 20,
    isQuiz: true,
    learningSettings: { learning_mode: 'practice', practice_mode: true },
    questions: [
      { type: 'text', text: 'CHẾ ĐỘ TỰ LUYỆN: Bộ câu hỏi trắc nghiệm ôn tập. Sau khi chọn đáp án, hệ thống sẽ hiển thị ngay đáp án đúng kèm giải thích chi tiết.' },
      { type: 'radio', text: 'Câu 1: Đơn vị đo tần số trong hệ SI là gì?', options: ['Hertz (Hz)', 'Watt (W)', 'Joule (J)', 'Pascal (Pa)'], correct_answer: 'Hertz (Hz)', explanation: 'Tần số đo bằng Hertz (Hz).' },
      { type: 'radio', text: 'Câu 2: Trong Tiếng Anh, từ trái nghĩa với "Generous" là:', options: ['Mean / Stingy', 'Kind', 'Polite', 'Brave'], correct_answer: 'Mean / Stingy', explanation: 'Generous (Rộng lượng) >< Mean/Stingy (Keo kiệt).' },
      { type: 'radio', text: 'Câu 3: Axit nào có trong dạ dày con người hỗ trợ tiêu hóa?', options: ['Axit Clohidric (HCl)', 'Axit Sunfuric (H2SO4)', 'Axit Axetic (CH3COOH)', 'Axit Nitric (HNO3)'], correct_answer: 'Axit Clohidric (HCl)', explanation: 'Dạ dày chứa dung dịch HCl nồng độ ~0.001 - 0.01M.' },
      { type: 'radio', text: 'Câu 4: Kim loại nào ở thể lỏng ở điều kiện nhiệt độ phòng?', options: ['Thủy ngân (Hg)', 'Chì (Pb)', 'Nhôm (Al)', 'Kẽm (Zn)'], correct_answer: 'Thủy ngân (Hg)', explanation: 'Thủy ngân là kim loại duy nhất ở thể lỏng ở nhiệt độ phòng.' },
      { type: 'radio', text: 'Câu 5: Điền từ đúng: "She is interested _____ learning new languages."', options: ['in', 'on', 'at', 'about'], correct_answer: 'in', explanation: 'Cấu trúc: to be interested in + V-ing.' },
      { type: 'radio', text: 'Câu 6: Ai là người phát minh ra bóng đèn dây tóc thương mại đầu tiên?', options: ['Thomas Edison', 'Nikola Tesla', 'Alexander Bell', 'Albert Einstein'], correct_answer: 'Thomas Edison', explanation: 'Thomas Edison hoàn thiện bóng đèn dây tóc năm 1879.' },
      { type: 'radio', text: 'Câu 7: Đâu là hành tinh lớn nhất trong Hệ Mặt Trời?', options: ['Sao Mộc (Jupiter)', 'Sao Thổ (Saturn)', 'Sao Hỏa (Mars)', 'Sao Hải Vương'], correct_answer: 'Sao Mộc (Jupiter)', explanation: 'Sao Mộc là hành tinh lớn nhất.' },
      { type: 'radio', text: 'Câu 8: Cấu trúc dữ liệu nào hoạt động theo nguyên tắc LIFO (Last In First Out)?', options: ['Stack (Ngăn xếp)', 'Queue (Hàng đợi)', 'Array (Mảng)', 'Linked List'], correct_answer: 'Stack (Ngăn xếp)', explanation: 'Stack là vào sau ra trước (LIFO).' },
      { type: 'radio', text: 'Câu 9: Điền từ đúng: "If I _____ rich, I would travel around the world."', options: ['were', 'am', 'will be', 'have been'], correct_answer: 'were', explanation: 'Câu điều kiện loại 2 giả định trái hiện tại dùng "were".' },
      { type: 'radio', text: 'Câu 10: Quốc gia nào là quê hương của vũ điệu Samba?', options: ['Brazil', 'Argentina', 'Tây Ban Nha', 'Ý'], correct_answer: 'Brazil', explanation: 'Samba là vũ điệu truyền thống của Brazil.' },
      { type: 'radio', text: 'Câu 11: Thành phần nào trong máu đóng vai trò vận chuyển Oxi?', options: ['Hồng cầu', 'Bạch cầu', 'Tiểu cầu', 'Huyết tương'], correct_answer: 'Hồng cầu', explanation: 'Hồng cầu chứa Hemoglobin giúp vận chuyển Oxi.' },
      { type: 'radio', text: 'Câu 12: Đâu là mã trạng thái HTTP hiển thị "Not Found"?', options: ['404', '200', '500', '403'], correct_answer: '404', explanation: '404 Not Found là lỗi không tìm thấy tài nguyên.' },
      { type: 'radio', text: 'Câu 13: Đơn vị tiền tệ chính thức của Nhật Bản là gì?', options: ['Yên (JPY)', 'Won (KRW)', 'Tệ (CNY)', 'Baht (THB)'], correct_answer: 'Yên (JPY)', explanation: 'Nhật Bản dùng đồng Yên (Yen).' },
      { type: 'radio', text: 'Câu 14: Điền từ: "Look at those black clouds! It _____ rain soon."', options: ['is going to', 'will', 'shall', 'may'], correct_answer: 'is going to', explanation: 'Dự đoán có bằng chứng hiện tại dùng "be going to".' },
      { type: 'radio', text: 'Câu 15: Định luật I Newton còn được gọi là định luật gì?', options: ['Định luật Quán tính', 'Định luật Vạn vật hấp dẫn', 'Định luật Bảo toàn năng lượng', 'Định luật Động lượng'], correct_answer: 'Định luật Quán tính', explanation: 'Định luật I Newton về quán tính của vật.' },
      { type: 'radio', text: 'Câu 16: Chất nào làm quỳ tím hóa đỏ?', options: ['Axit', 'Bazơ', 'Muối ăn', 'Nước cất'], correct_answer: 'Axit', explanation: 'Dung dịch Axit làm quỳ tím đổi sang màu đỏ.' },
      { type: 'radio', text: 'Câu 17: Trong thiết kế phần mềm, HTML là viết tắt của:', options: ['HyperText Markup Language', 'HighTech Machine Language', 'HyperTransfer Mode Logic', 'Home Tool Markup Language'], correct_answer: 'HyperText Markup Language', explanation: 'HTML là ngôn ngữ đánh dấu siêu văn bản.' },
      { type: 'radio', text: 'Câu 18: Tác phẩm kịch "Romeo và Juliet" do ai sáng tác?', options: ['William Shakespeare', 'Victor Hugo', 'Charles Dickens', 'Mark Twain'], correct_answer: 'William Shakespeare', explanation: 'Shakespeare sáng tác Romeo & Juliet năm 1595.' },
      { type: 'radio', text: 'Câu 19: Đỉnh núi cao nhất thế giới là đỉnh núi nào?', options: ['Everest', 'K2', 'Kanchenjunga', 'Fuji'], correct_answer: 'Everest', explanation: 'Đỉnh Everest thuộc dãy Himalaya cao 8,848m.' },
      { type: 'radio', text: 'Câu 20: Công thức hóa học của nước cất là gì?', options: ['H2O', 'CO2', 'NaCl', 'H2SO4'], correct_answer: 'H2O', explanation: 'Nước gồm 2 nguyên tử H và 1 nguyên tử O.' }
    ]
  },

  // 5. SỰ KIỆN - ĐĂNG KÝ EVENT / WORKSHOP (EVENT #1)
  {
    id: 'event-reg',
    name: 'Đăng ký Tham gia Event / Workshop',
    category: 'event',
    badge: '🎪 Dành cho Ban Tổ Chức Sự Kiện & MC',
    targetAudience: 'Event Organizers, Workshop Facilitator, Ban Truyền Thông',
    shortDesc: 'Thu nhận đăng ký vé & giới hạn số lượng người tham dự',
    fullIntro: 'Form 20 câu hỏi đăng ký tham gia Workshop/Sự kiện chuyên nghiệp. Tích hợp tính năng giới hạn số lượng vé (Quota limit), phân loại loại vé, nhu cầu hậu cần và thu thập trước câu hỏi cho diễn giả.',
    questionCount: 20,
    isQuiz: false,
    learningSettings: { max_responses: 50 },
    questions: [
      { type: 'text', text: 'ĐĂNG KÝ VÉ SỰ KIỆN: Vui lòng hoàn thành form đăng ký dưới đây để nhận Mã vé QR tham dự Workshop.' },
      { type: 'text', text: 'Câu 1: Họ và tên người tham dự' },
      { type: 'text', text: 'Câu 2: Số điện thoại nhận mã xác nhận Zalo' },
      { type: 'text', text: 'Câu 3: Địa chỉ Email nhận Mã vé QR' },
      { type: 'text', text: 'Câu 4: Đơn vị công tác / Trường học / Công ty' },
      { type: 'text', text: 'Câu 5: Chức danh / Chuyên ngành hiện tại' },
      { type: 'radio', text: 'Câu 6: Hình thức tham dự mong muốn:', options: ['Trực tiếp tại Hội trường', 'Trực tuyến qua Zoom Webinar'] },
      { type: 'radio', text: 'Câu 7: Loại vé đăng ký:', options: ['Vé Phổ thông (Miễn phí)', 'Vé VIP (Bao gồm tài liệu & Tiệc ngọt)', 'Vé Sinh viên (Ưu đãi 50%)'] },
      { type: 'checkbox', text: 'Câu 8: Kênh thông tin giúp bạn biết tới Sự kiện (Chọn nhiều):', options: ['Fanpage Sự kiện', 'Giới thiệu từ đồng nghiệp', 'Email thiệp mời', 'Bài viết báo chí'] },
      { type: 'checkbox', text: 'Câu 9: Chủ đề bạn quan tâm nhất tại Workshop (Chọn nhiều):', options: ['Ứng dụng AI thực chiến', 'Chiến lược Marketing 0 đồng', 'Quản trị dòng tiền Startup', 'Networking & Kết nối đầu tư'] },
      { type: 'textarea', text: 'Câu 10: Câu hỏi cụ thể bạn muốn đặt cho Diễn giả tại phần Q&A' },
      { type: 'radio', text: 'Câu 11: Bạn đã từng tham gia sự kiện nào do BTC tổ chức chưa?', options: ['Lần đầu tiên tham gia', 'Đã từng tham gia 1-2 lần', 'Khách hàng thân thiết'] },
      { type: 'radio', text: 'Câu 12: Yêu cầu đặc biệt về chỗ ngồi / Hậu cần:', options: ['Không có yêu cầu', 'Cần chỗ ngồi lối đi', 'Phiên dịch Tiếng Anh'] },
      { type: 'scale', text: 'Câu 13: Mức độ quan tâm của bạn đối với chủ đề sự kiện đợt này (1-5)' },
      { type: 'radio', text: 'Câu 14: Bạn sẽ đi cùng bạn bè / đồng nghiệp không?', options: ['Đi cá nhân 1 mình', 'Đi cùng nhóm 2-3 người', 'Đi cùng đoàn công ty'] },
      { type: 'checkbox', text: 'Câu 15: Bạn mong muốn nhận tài liệu sau sự kiện qua hình thức nào?', options: ['File PDF qua Email', 'Slide trên nhóm Zalo', 'Sách in tại bàn check-in'] },
      { type: 'radio', text: 'Câu 16: Bạn có sẵn lòng chia sẻ thông tin sự kiện lên trang cá nhân không?', options: ['Sẵn sàng chia sẻ', 'Cần cân nhắc thêm', 'Không'] },
      { type: 'textarea', text: 'Câu 17: Kỳ vọng lớn nhất của bạn sau khi kết thúc buổi Workshop' },
      { type: 'radio', text: 'Câu 18: Đồng ý nhận bản tin sự kiện hàng tháng từ BTC:', options: ['Đồng ý nhận tin qua Email', 'Chỉ nhận tin sự kiện này'] },
      { type: 'checkbox', text: 'Câu 19: Quy định sự kiện (Cam kết):', options: ['Có mặt đúng giờ check-in (trước 15p)', 'Trang phục lịch sự', 'Tuân thủ quy định hội trường'] },
      { type: 'textarea', text: 'Câu 20: Lời nhắn tới Ban tổ chức' }
    ]
  },

  // 6. SỰ KIỆN - KHẢO SÁT FEEDBACK SỰ KIỆN (EVENT #2)
  {
    id: 'event-feedback',
    name: 'Khảo sát Feedback Sự kiện',
    category: 'event',
    badge: '🎪 Dành cho Ban Tổ Chức Sự Kiện & Đánh Giá Quality',
    targetAudience: 'Ban Quản Lý Sự Kiện, Diễn giả, Ban Hậu Cần',
    shortDesc: 'Khảo sát đánh giá trải nghiệm sau sự kiện & lời cảm ơn',
    fullIntro: 'Bảng khảo sát 20 câu đánh giá trải nghiệm toàn diện sau Event/Workshop: Nội dung chia sẻ của diễn giả, chất lượng tài liệu, khâu hậu cần tiệc ngọt, địa điểm và mức độ sẵn sàng giới thiệu sự kiện tới bạn bè.',
    questionCount: 20,
    isQuiz: false,
    questions: [
      { type: 'text', text: 'CẢM ƠN BẠN ĐÃ THAM GIA: Ý kiến đóng góp của bạn giúp Ban tổ chức nâng cấp chất lượng cho các kỳ sự kiện tiếp theo.' },
      { type: 'scale', text: 'Câu 1: Đánh giá độ hài lòng chung của bạn về sự kiện hôm nay (1 - Rất kém, 5 - Rất tốt)' },
      { type: 'scale', text: 'Câu 2: Chất lượng nội dung chia sẻ của các Diễn giả (1-5)' },
      { type: 'scale', text: 'Câu 3: Phong cách truyền đạt và khả năng tương tác của Diễn giả (1-5)' },
      { type: 'scale', text: 'Câu 4: Địa điểm tổ chức (không gian, âm thanh, ánh sáng, màn hình chiếu) (1-5)' },
      { type: 'scale', text: 'Câu 5: Khâu đón tiếp và hỗ trợ check-in của Ban lễ tân (1-5)' },
      { type: 'scale', text: 'Câu 6: Chất lượng tiệc teabreak / tiệc ngọt nghỉ giữa giờ (1-5)' },
      { type: 'scale', text: 'Câu 7: Tài liệu / Slide trình chiếu gửi cho khách tham dự (1-5)' },
      { type: 'scale', text: 'Câu 8: Thời lượng phân bổ cho các phần (Trình bày, Q&A, Networking) hợp lý (1-5)' },
      { type: 'checkbox', text: 'Câu 9: Phần nội dung bạn ấn tượng nhất (Chọn nhiều):', options: ['Bài chia sẻ chính của Keynote Speaker', 'Phần thảo luận Panel Discussion', 'Hỏi đáp Q&A trực tiếp', 'Hoạt động Networking trao đổi danh thiếp'] },
      { type: 'radio', text: 'Câu 10: Bạn có đủ thời gian đặt câu hỏi cho diễn giả không?', options: ['Đủ thời gian giải đáp', 'Cần thêm thời gian Q&A', 'Chưa kịp đặt câu hỏi'] },
      { type: 'scale', text: 'Câu 11: Mức độ giá trị thực tiễn của kiến thức thu nhận được đối với công việc (1-5)' },
      { type: 'scale', text: 'Câu 12: Khả năng bạn giới thiệu sự kiện tới đồng nghiệp / bạn bè (Thang NPS 1-10)' },
      { type: 'radio', text: 'Câu 13: Bạn có muốn tiếp tục tham gia các Workshop kỳ sau của BTC không?', options: ['Có, chắc chắn', 'Tùy thuộc chủ đề', 'Không'] },
      { type: 'radio', text: 'Câu 14: Mức phí tham dự sự kiện có tương xứng với giá trị nhận được không?', options: ['Rất xứng đáng', 'Hợp lý', 'Hơi cao so với giá trị'] },
      { type: 'checkbox', text: 'Câu 15: Góp ý khâu hậu cần cần cải thiện (Chọn nhiều):', options: ['Âm thanh micro hơi nhỏ', 'Màn hình chiếu bị mờ', 'Hội trường hơi lạnh / nóng', 'Tiệc ngọt bổ sung thêm bánh', 'Check-in bị đông'] },
      { type: 'textarea', text: 'Câu 16: Diễn giả hoặc chuyên gia bạn mong muốn BTC mời trong sự kiện tới' },
      { type: 'textarea', text: 'Câu 17: Gợi ý chủ đề sự kiện tiếp theo bạn muốn tham dự' },
      { type: 'radio', text: 'Câu 18: Hình thức tổ chức sự kiện bạn yêu thích nhất:', options: ['Trực tiếp Offline tại khách sạn/hội trường', 'Online Webinar qua Zoom', 'Hybrid kết hợp'] },
      { type: 'textarea', text: 'Câu 19: Lời nhắn nhủ hoặc góp ý chân thành dành cho Ban Tổ Chức' },
      { type: 'voice', text: 'Câu 20: Gửi nhận xét voice âm thanh phản hồi trực tiếp cho BTC' }
    ]
  },

  // 7. DOANH NGHIỆP - NGHIÊN CỨU NHU CẦU SẢN PHẨM (BUSINESS #1)
  {
    id: 'market-research',
    name: 'Nghiên cứu Nhu cầu Sản phẩm',
    category: 'business',
    badge: '💼 Dành cho Doanh Nghiệp & Marketer',
    targetAudience: 'Nhà nghiên cứu thị trường, Phòng R&D, Marketer, Founder',
    shortDesc: 'Khảo sát hành vi tiêu dùng & mức giá chi trả khách hàng',
    fullIntro: 'Khảo sát 20 câu nghiên cứu thị trường, phân tích hành vi tiêu dùng, tần suất sử dụng, yếu tố quyết định mua hàng, tính năng mong muốn và mức giá sẵn sàng chi trả cho sản phẩm mới.',
    questionCount: 20,
    isQuiz: false,
    questions: [
      { type: 'text', text: 'KHẢO SÁT THỊ TRƯỜNG: Ý kiến của bạn đóng vai trò quyết định giúp chúng tôi nghiên cứu phát triển sản phẩm mới đáp ứng tốt nhất nhu cầu người dùng.' },
      { type: 'radio', text: 'Câu 1: Tần suất bạn sử dụng nhóm sản phẩm dịch vụ này hiện tại:', options: ['Hàng ngày', 'Hàng tuần', 'Hàng tháng', 'Hiếm khi sử dụng'] },
      { type: 'radio', text: 'Câu 2: Bạn thường mua/sử dụng sản phẩm qua kênh nào?', options: ['Cửa hàng trực tiếp', 'Sàn E-commerce (Shopee/Lazada)', 'Website chính hãng', 'Mạng xã hội TikTok/FB'] },
      { type: 'checkbox', text: 'Câu 3: Yếu tố quan trọng nhất khi bạn lựa chọn sản phẩm (Chọn 3):', options: ['Chất lượng sản phẩm', 'Giá cả hợp lý', 'Thương hiệu uy tín', 'Dịch vụ hậu mãi / Bảo hành', 'Khuyến mãi hấp dẫn', 'Mẫu mã thiết kế đẹp'] },
      { type: 'radio', text: 'Câu 4: Bạn có hài lòng với các sản phẩm hiện có trên thị trường không?', options: ['Rất hài lòng', 'Tương đối hài lòng', 'Chưa hài lòng hoàn toàn'] },
      { type: 'textarea', text: 'Câu 5: Nhược điểm lớn nhất của các sản phẩm hiện tại bạn đang dùng' },
      { type: 'scale', text: 'Câu 6: Mức độ quan tâm của bạn đối với dòng sản phẩm mới thông minh tích hợp AI (1-5)' },
      { type: 'checkbox', text: 'Câu 7: Các tính năng bạn mong muốn nhất ở sản phẩm mới (Chọn nhiều):', options: ['Tự động hóa thông minh', 'Tiết kiệm điện năng / thời gian', 'Điều khiển từ xa qua smartphone', 'Thiết kế nhỏ gọn bảo vệ môi trường'] },
      { type: 'radio', text: 'Câu 8: Mức giá chi trả hợp lý bạn sẵn sàng bỏ ra cho sản phẩm này:', options: ['Dưới 500,000đ', '500,000đ - 1,500,000đ', '1,500,000đ - 3,000,000đ', 'Trên 3,000,000đ'] },
      { type: 'radio', text: 'Câu 9: Hình thức thanh toán bạn ưa chuộng nhất:', options: ['Chuyển khoản QR / Momo', 'Thẻ tín dụng / Trả góp 0%', 'Tiền mặt khi nhận hàng (COD)'] },
      { type: 'radio', text: 'Câu 10: Bạn sẵn sàng đặt hàng trước (Pre-order) nếu nhận ưu đãi giảm 20%?', options: ['Có, sẵn sàng đặt trước', 'Cần xem xét đánh giá', 'Không'] },
      { type: 'scale', text: 'Câu 11: Mức độ ảnh hưởng của Đánh giá / Review từ KOLs tới quyết định mua của bạn (1-5)' },
      { type: 'radio', text: 'Câu 12: Thời gian bảo hành tối thiểu bạn kỳ vọng cho sản phẩm:', options: ['6 tháng', '12 tháng', '24 tháng đổi mới'] },
      { type: 'checkbox', text: 'Câu 13: Dịch vụ đi kèm nào khiến bạn ưu tiên chốt đơn (Chọn nhiều):', options: ['Giao hàng hỏa tốc trong ngày', 'Miễn phí đổi trả 30 ngày', 'Tặng kèm phụ kiện cao cấp'] },
      { type: 'radio', text: 'Câu 14: Thu nhập trung bình hàng tháng của bạn:', options: ['Dưới 10 triệu', '10 - 20 triệu', '20 - 35 triệu', 'Trên 35 triệu'] },
      { type: 'radio', text: 'Câu 15: Độ tuổi của bạn:', options: ['Dưới 22 tuổi', '22 - 30 tuổi', '31 - 45 tuổi', 'Trên 45 tuổi'] },
      { type: 'radio', text: 'Câu 16: Khu vực sinh sống hiện tại:', options: ['Hà Nội / TP.HCM', 'Các Thành phố lớn', 'Tỉnh/Thành khác'] },
      { type: 'textarea', text: 'Câu 17: Tên thương hiệu sản phẩm bạn đang tin dùng nhất hiện nay' },
      { type: 'scale', text: 'Câu 18: Khả năng bạn sẽ mua thử sản phẩm mới khi ra mắt trong tháng tới (1-5)' },
      { type: 'text', text: 'Câu 19: để lại Số điện thoại hoặc Email để nhận Voucher ưu đãi 20% khi sản phẩm ra mắt' },
      { type: 'textarea', text: 'Câu 20: Đóng góp ý kiến thêm cho đội ngũ nghiên cứu phát triển sản phẩm' }
    ]
  },

  // 8. DOANH NGHIỆP - ĐÁNH GIÁ HÀI LÒNG CSAT & NPS (BUSINESS #2)
  {
    id: 'csat-nps',
    name: 'Đánh giá Hài lòng CSAT & NPS',
    category: 'business',
    badge: '💼 Dành cho Chăm Sóc Khách Hàng & QA',
    targetAudience: 'Phòng CSKH, Quản lý Trải nghiệm Khách hàng (CX), Chăm sóc Đối tác',
    shortDesc: 'Đo lường chỉ số giới thiệu thương hiệu & lý do hài lòng',
    fullIntro: 'Bộ 20 câu khảo sát đánh giá độ hài lòng khách hàng CSAT & chỉ số giới thiệu thương hiệu NPS, kèm logic rẽ nhánh tự động thu thập lý do cho nhóm khách hàng chưa hài lòng.',
    questionCount: 20,
    isQuiz: false,
    questions: [
      { type: 'text', text: 'KHẢO SÁT TRẢI NGHIỆM KHÁCH HÀNG: Cảm ơn bạn đã tin tưởng dịch vụ! Hãy dành 2 phút đánh giá trải nghiệm để giúp chúng tôi phục vụ tốt hơn.' },
      { type: 'scale', text: 'Câu 1: [NPS] Từ 1 đến 10, khả năng bạn giới thiệu thương hiệu của chúng tôi cho đồng nghiệp/bạn bè là bao nhiêu?' },
      { type: 'scale', text: 'Câu 2: [CSAT] Mức độ hài lòng tổng thể của bạn đối với đơn hàng / dịch vụ vừa trải nghiệm (1-5)' },
      { type: 'scale', text: 'Câu 3: Thái độ phục vụ và sự chuyên nghiệp của nhân viên tư vấn / CSKH (1-5)' },
      { type: 'scale', text: 'Câu 4: Tốc độ phản hồi và hỗ trợ giải quyết thắc mắc của tổng đài / chat (1-5)' },
      { type: 'scale', text: 'Câu 5: Thời gian giao hàng / bàn giao sản phẩm đúng cam kết (1-5)' },
      { type: 'scale', text: 'Câu 6: Chất lượng đóng gói và tình trạng nguyên vẹn của sản phẩm khi nhận (1-5)' },
      { type: 'scale', text: 'Câu 7: Độ rõ ràng và chính xác của thông tin sản phẩm trên Website/App (1-5)' },
      { type: 'scale', text: 'Câu 8: Quy trình thanh toán đơn giản, đa dạng phương thức (1-5)' },
      { type: 'radio', text: 'Câu 9: Bạn đã sử dụng dịch vụ của chúng tôi được bao lâu?', options: ['Lần đầu tiên', 'Dưới 6 tháng', '6 tháng - 1 năm', 'Trên 1 năm'] },
      { type: 'radio', text: 'Câu 10: Bạn có muốn tiếp tục gắn bó và tái mua sản phẩm của chúng tôi không?', options: ['Có, chắc chắn', 'Cần suy nghĩ thêm', 'Không'], is_branching: true, id: 'q10' },
      { type: 'textarea', text: 'Câu 11: Lý do cụ thể khiến bạn chưa hoàn toàn hài lòng hoặc chưa muốn tái mua?', visibility: { condition_question_id: 'q10', condition_value: 'Không' } },
      { type: 'checkbox', text: 'Câu 12: Điểm mạnh lớn nhất của chúng tôi làm bạn ấn tượng (Chọn nhiều):', options: ['Sản phẩm chất lượng cao', 'Nhân viên nhiệt tình thân thiện', 'Giao hàng nhanh', 'Giá cả cạnh tranh', 'Chính sách bảo hành uy tín'] },
      { type: 'checkbox', text: 'Câu 13: Khâu cần cải thiện nhất trong trải nghiệm của bạn (Chọn nhiều):', options: ['Thời gian xử lý sự cố chậm', 'Phí giao hàng hơi cao', 'Ứng dụng đôi lúc chập chờn', 'Thiếu chương trình tri ân'] },
      { type: 'scale', text: 'Câu 14: Giá trị nhận được tương xứng với chi phí bỏ ra (1-5)' },
      { type: 'radio', text: 'Câu 15: Bạn hay liên hệ hỗ trợ qua kênh nào nhất?', options: ['Hotline điện thoại', 'Zalo Official Account', 'Live Chat Website', 'Fanpage Facebook'] },
      { type: 'scale', text: 'Câu 16: Mức độ dễ dàng khi thực hiện thủ tục bảo hành / đổi trả (1-5)' },
      { type: 'radio', text: 'Câu 17: Bạn có quan tâm đến Chương trình Khách hàng Thân thiết (VVIP) không?', options: ['Có, muốn tham gia tích điểm', 'Đã là thành viên', 'Không quan tâm'] },
      { type: 'textarea', text: 'Câu 18: Lời khen hoặc biểu dương dành cho nhân viên tư vấn đã hỗ trợ bạn' },
      { type: 'textarea', text: 'Câu 19: Góp ý chân thành để chúng tôi hoàn thiện chất lượng dịch vụ' },
      { type: 'text', text: 'Câu 20: Mã đơn hàng hoặc Số điện thoại mua hàng (Nếu muốn nhận quà tri ân từ CSKH)' }
    ]
  }
];
