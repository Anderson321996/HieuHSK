document.addEventListener('DOMContentLoaded', () => {
    let currentVocabulary = typeof hsk1_vocabulary !== 'undefined' ? hsk1_vocabulary : [];
    let currentSentences = typeof hsk1_sentences !== 'undefined' ? hsk1_sentences : [];
    let currentReading = typeof hsk1_reading !== 'undefined' ? hsk1_reading : [];
    
    // TTS function
    function speak(text, isSlow = false) {
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel(); // cancel any ongoing speech
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'zh-CN';
            
            // Tốc độ chậm dễ bị méo tiếng ở một số giọng đọc, để 0.9 (hoặc 0.85 nếu yêu cầu đọc chậm) sẽ tự nhiên hơn
            utterance.rate = isSlow ? 0.85 : 0.9; 
            utterance.pitch = 1.0;

            // Tìm giọng đọc chất lượng cao (Google, Microsoft Xiaoxiao/Huihui)
            const voices = window.speechSynthesis.getVoices();
            if (voices.length > 0) {
                const bestVoice = voices.find(v => v.lang.includes('zh') && (v.name.includes('Google') || v.name.includes('Xiaoxiao') || v.name.includes('Huihui') || v.name.includes('Natural'))) 
                               || voices.find(v => v.lang === 'zh-CN');
                if (bestVoice) {
                    utterance.voice = bestVoice;
                }
            }
            
            window.speechSynthesis.speak(utterance);
        } else {
            alert('Trình duyệt của bạn không hỗ trợ tính năng đọc văn bản.');
        }
    }

    // Đảm bảo trình duyệt tải danh sách giọng đọc (đặc biệt quan trọng trên Chrome)
    if ('speechSynthesis' in window) {
        window.speechSynthesis.onvoiceschanged = () => {
            window.speechSynthesis.getVoices();
        };
    }
    // Set current date
    const dateDisplay = document.querySelector('#current-date span');
    if (dateDisplay) {
        const today = new Date();
        const options = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
        dateDisplay.innerText = today.toLocaleDateString('vi-VN', options);
    }
    
    // HSK Level Selection
    const levelSelector = document.getElementById('hsk-level-selector');
    const learnTitle = document.getElementById('learn-title');
    
    levelSelector.addEventListener('change', (e) => {
        const level = e.target.value;
        if (level === '1') {
            currentVocabulary = typeof hsk1_vocabulary !== 'undefined' ? hsk1_vocabulary : [];
            currentSentences = typeof hsk1_sentences !== 'undefined' ? hsk1_sentences : [];
            currentReading = typeof hsk1_reading !== 'undefined' ? hsk1_reading : [];
        } else if (level === '2') {
            currentVocabulary = typeof hsk2_vocabulary !== 'undefined' ? hsk2_vocabulary : [];
            currentSentences = typeof hsk2_sentences !== 'undefined' ? hsk2_sentences : [];
            currentReading = typeof hsk2_reading !== 'undefined' ? hsk2_reading : [];
        } else if (level === '3') {
            currentVocabulary = typeof hsk3_vocabulary !== 'undefined' ? hsk3_vocabulary : [];
            currentSentences = typeof hsk3_sentences !== 'undefined' ? hsk3_sentences : [];
            currentReading = typeof hsk3_reading !== 'undefined' ? hsk3_reading : [];
        }
        
        learnTitle.innerText = `Học Từ Vựng HSK ${level}`;
        
        // Update category filter dynamically
        // Refresh current active tab
        const activeTab = document.querySelector('.nav-links li.active').dataset.tab;
        if (activeTab === 'learn') {
            renderFlashcards();
        } else if (activeTab === 'practice') {
            initPractice();
        } else if (activeTab === 'quiz') {
            resetQuiz();
        } else if (activeTab === 'sentence') {
            initSentencePractice();
        } else if (activeTab === 'listening') {
            initListening();
        } else if (activeTab === 'reading') {
            initReading();
        } else if (activeTab === 'mock-exam') {
            if(typeof initMockExamList === 'function') initMockExamList();
        }
    });



    // === 1. TAB NAVIGATION ===
    const tabs = document.querySelectorAll('.nav-links li');
    const tabContents = document.querySelectorAll('.tab-content');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Stop any ongoing audio when switching tabs
            if ('speechSynthesis' in window) {
                window.speechSynthesis.cancel();
            }

            // Remove active from all
            tabs.forEach(t => t.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));

            // Add active to current
            tab.classList.add('active');
            const targetId = `tab-${tab.dataset.tab}`;
            document.getElementById(targetId).classList.add('active');
            
            // Re-initialize specific tab logic
            if (tab.dataset.tab === 'learn') {
                renderFlashcards();
            } else if(tab.dataset.tab === 'practice') {
                initPractice();
            } else if (tab.dataset.tab === 'quiz') {
                resetQuiz();
            } else if (tab.dataset.tab === 'sentence') {
                initSentencePractice();
            } else if (tab.dataset.tab === 'listening') {
                initListening();
            } else if (tab.dataset.tab === 'reading') {
                initReading();
            } else if (tab.dataset.tab === 'mock-exam') {
                if(typeof initMockExamList === 'function') initMockExamList();
            }
        });
    });

    // === 2. LEARN TAB (LESSON DASHBOARD VIEW) ===
    let learnedVocabIds = JSON.parse(localStorage.getItem('hsk_learned_vocab')) || [];
    // Removed const WORDS_PER_LESSON
    
    const lessonDashboard = document.getElementById('lesson-dashboard');
    const lessonActive = document.getElementById('lesson-active');
    const lessonGrid = document.getElementById('lesson-grid');
    const activeLessonContent = document.getElementById('active-lesson-content');
    const resetProgressBtn = document.getElementById('reset-vocab-progress-btn');
    const backBtn = document.getElementById('back-to-lessons-btn');

    function initVocabLearning() {
        updateDashboardProgress();
        renderLessonGrid();
    }

    function updateDashboardProgress() {
        if (!document.getElementById('vocab-total-dashboard')) return;
        const total = currentVocabulary.length;
        const learned = currentVocabulary.filter(w => learnedVocabIds.includes(w.id)).length;
        
        document.getElementById('vocab-total-dashboard').innerText = total;
        document.getElementById('vocab-total-learned-dashboard').innerText = learned;
        
        const pct = total > 0 ? Math.round((learned / total) * 100) : 0;
        document.getElementById('vocab-total-pct').innerText = `${pct}%`;
        
        const pctEl = document.getElementById('vocab-total-pct').parentElement;
        pctEl.style.background = `conic-gradient(var(--success) ${pct}%, var(--border-color) ${pct}%)`;
    }

    let currentLessonPage = 0;
    const LESSONS_PER_PAGE = 4;

    function renderLessonGrid() {
        if (!lessonGrid) return;
        lessonGrid.innerHTML = '';
        if (currentVocabulary.length === 0) return;
        
        const totalLessons = 10;
        const wordsPerLesson = Math.ceil(currentVocabulary.length / totalLessons);
        const totalPages = Math.ceil(totalLessons / LESSONS_PER_PAGE);
        
        // Ensure current page is valid when switching levels
        if (currentLessonPage >= totalPages) currentLessonPage = 0;
        
        const startLesson = currentLessonPage * LESSONS_PER_PAGE;
        const endLesson = Math.min((currentLessonPage + 1) * LESSONS_PER_PAGE, totalLessons);
        
        for (let i = startLesson; i < endLesson; i++) {
            const startIdx = i * wordsPerLesson;
            const endIdx = Math.min((i + 1) * wordsPerLesson, currentVocabulary.length);
            
            // If startIdx is beyond vocabulary length, don't create an empty lesson
            if (startIdx >= currentVocabulary.length) continue;
            
            const lessonWords = currentVocabulary.slice(startIdx, endIdx);
            
            const learnedInLesson = lessonWords.filter(w => learnedVocabIds.includes(w.id)).length;
            const isCompleted = learnedInLesson === lessonWords.length;
            const pct = Math.round((learnedInLesson / lessonWords.length) * 100);
            
            const card = document.createElement('div');
            card.className = 'lesson-card';
            card.style.background = isCompleted ? 'rgba(16, 185, 129, 0.05)' : 'white';
            card.style.border = isCompleted ? '1px solid var(--success)' : '1px solid var(--border-color)';
            card.style.borderRadius = '16px';
            card.style.padding = '1.5rem';
            card.style.cursor = 'pointer';
            card.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
            card.style.boxShadow = '0 4px 15px rgba(0,0,0,0.02)';
            
            card.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem;">
                    <div>
                        <h4 style="font-size: 1.1rem; color: ${isCompleted ? 'var(--success)' : 'var(--primary-color)'}; margin-bottom: 0.2rem;">Chặng ${i + 1}</h4>
                        <span style="font-size: 0.85rem; color: var(--text-muted);">Từ ${startIdx + 1} - ${endIdx}</span>
                    </div>
                    ${isCompleted ? '<div style="background: var(--success); color: white; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center;"><i class="ri-check-line"></i></div>' : ''}
                </div>
                
                <div style="margin-top: 1.5rem;">
                    <div style="display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 0.4rem; color: var(--text-muted);">
                        <span>Tiến độ</span>
                        <span style="color: ${isCompleted ? 'var(--success)' : 'var(--text-main)'}; font-weight: 600;">${learnedInLesson}/${lessonWords.length}</span>
                    </div>
                    <div class="progress-bar" style="height: 6px;">
                        <div class="progress-fill" style="width: ${pct}%; background: ${isCompleted ? 'var(--success)' : 'linear-gradient(90deg, var(--primary-color), #10b981)'};"></div>
                    </div>
                </div>
            `;
            
            card.addEventListener('mouseenter', () => {
                card.style.transform = 'translateY(-4px)';
                card.style.boxShadow = '0 12px 25px rgba(0,0,0,0.08)';
                card.style.borderColor = isCompleted ? 'var(--success)' : 'var(--primary-color)';
            });
            card.addEventListener('mouseleave', () => {
                card.style.transform = 'translateY(0)';
                card.style.boxShadow = '0 4px 15px rgba(0,0,0,0.02)';
                card.style.borderColor = isCompleted ? 'var(--success)' : 'var(--border-color)';
            });
            
            card.addEventListener('click', () => {
                openLesson(i, lessonWords);
            });
            
            lessonGrid.appendChild(card);
        }

        // Pagination controls
        if (totalPages > 1) {
            const paginationContainer = document.createElement('div');
            paginationContainer.style.display = 'flex';
            paginationContainer.style.justifyContent = 'center';
            paginationContainer.style.alignItems = 'center';
            paginationContainer.style.marginTop = '1rem';
            paginationContainer.style.gap = '1.5rem';
            paginationContainer.style.gridColumn = '1 / -1'; 

            const prevBtn = document.createElement('button');
            prevBtn.className = 'btn';
            prevBtn.style.background = 'white';
            prevBtn.style.border = '1px solid var(--border-color)';
            prevBtn.style.color = 'var(--text-main)';
            prevBtn.innerHTML = '<i class="ri-arrow-left-s-line"></i> Trang trước';
            prevBtn.disabled = currentLessonPage === 0;
            prevBtn.style.opacity = currentLessonPage === 0 ? '0.5' : '1';
            prevBtn.onclick = () => {
                if (currentLessonPage > 0) {
                    currentLessonPage--;
                    renderLessonGrid();
                }
            };

            const pageInfo = document.createElement('span');
            pageInfo.style.fontWeight = '600';
            pageInfo.style.color = 'var(--text-muted)';
            pageInfo.innerText = `Trang ${currentLessonPage + 1} / ${totalPages}`;

            const nextBtn = document.createElement('button');
            nextBtn.className = 'btn';
            nextBtn.style.background = 'white';
            nextBtn.style.border = '1px solid var(--border-color)';
            nextBtn.style.color = 'var(--text-main)';
            nextBtn.innerHTML = 'Trang sau <i class="ri-arrow-right-s-line"></i>';
            nextBtn.disabled = currentLessonPage === totalPages - 1;
            nextBtn.style.opacity = currentLessonPage === totalPages - 1 ? '0.5' : '1';
            nextBtn.onclick = () => {
                if (currentLessonPage < totalPages - 1) {
                    currentLessonPage++;
                    renderLessonGrid();
                }
            };

            paginationContainer.appendChild(prevBtn);
            paginationContainer.appendChild(pageInfo);
            paginationContainer.appendChild(nextBtn);

            lessonGrid.appendChild(paginationContainer);
        }
    }

    let currentLessonWords = [];
    let currentLessonWordIndex = 0;

    function openLesson(lessonIndex, lessonWords) {
        if(lessonDashboard) lessonDashboard.classList.add('hidden');
        if(lessonActive) lessonActive.classList.remove('hidden');
        
        const headerTab = document.getElementById('learn-tab-header');
        if(headerTab) headerTab.classList.add('hidden');
        
        const titleEl = document.getElementById('active-lesson-title');
        if(titleEl) titleEl.innerText = `Chặng ${lessonIndex + 1}`;
        
        currentLessonWords = lessonWords;
        currentLessonWordIndex = 0;
        
        renderActiveLessonWords();
    }

    function renderActiveLessonWords() {
        if(!activeLessonContent) return;
        activeLessonContent.innerHTML = '';
        
        const updateLessonProgress = () => {
            const learned = currentLessonWords.filter(w => learnedVocabIds.includes(w.id)).length;
            const pEl = document.getElementById('active-lesson-progress');
            if(pEl) pEl.innerText = `${learned}/${currentLessonWords.length}`;
            updateDashboardProgress();
        };
        updateLessonProgress();

        if (currentLessonWords.length === 0) return;
        const word = currentLessonWords[currentLessonWordIndex];
        let isLearned = learnedVocabIds.includes(word.id);

        const container = document.createElement('div');
        
        // Navigation Bar
        const navBar = document.createElement('div');
        navBar.style.display = 'flex';
        navBar.style.justifyContent = 'space-between';
        navBar.style.alignItems = 'center';
        navBar.style.marginBottom = '1.5rem';
        
        const prevBtn = document.createElement('button');
        prevBtn.className = 'btn';
        prevBtn.innerHTML = '<i class="ri-arrow-left-s-line"></i> Trước';
        prevBtn.disabled = currentLessonWordIndex === 0;
        prevBtn.style.opacity = currentLessonWordIndex === 0 ? '0.5' : '1';
        prevBtn.onclick = () => { currentLessonWordIndex--; renderActiveLessonWords(); };
        
        const counter = document.createElement('span');
        counter.style.fontWeight = '600';
        counter.style.color = 'var(--text-muted)';
        counter.innerText = `Từ ${currentLessonWordIndex + 1} / ${currentLessonWords.length}`;
        
        const nextBtn = document.createElement('button');
        nextBtn.className = 'btn';
        nextBtn.innerHTML = 'Tiếp <i class="ri-arrow-right-s-line"></i>';
        nextBtn.disabled = currentLessonWordIndex === currentLessonWords.length - 1;
        nextBtn.style.opacity = currentLessonWordIndex === currentLessonWords.length - 1 ? '0.5' : '1';
        nextBtn.onclick = () => { currentLessonWordIndex++; renderActiveLessonWords(); };
        
        navBar.appendChild(prevBtn);
        navBar.appendChild(counter);
        navBar.appendChild(nextBtn);
        
        container.appendChild(navBar);

        // Word Card
        const card = document.createElement('div');
        card.style.background = isLearned ? 'rgba(16, 185, 129, 0.03)' : 'white';
        card.style.border = isLearned ? '2px solid rgba(16, 185, 129, 0.3)' : '2px solid var(--border-color)';
        card.style.borderRadius = '24px';
        card.style.padding = '1.5rem 2rem';
        card.style.textAlign = 'center';
        card.style.position = 'relative';
        card.style.boxShadow = '0 10px 40px rgba(0,0,0,0.03)';
        card.style.minHeight = '350px';
        card.style.display = 'flex';
        card.style.flexDirection = 'column';
        card.style.justifyContent = 'center';
        
        const renderCardContent = () => {
            card.innerHTML = `
                <button class="btn lesson-audio-btn" style="position: absolute; top: 1rem; right: 1rem; width: 44px; height: 44px; border-radius: 50%; padding: 0; display: flex; align-items: center; justify-content: center; background: rgba(139, 92, 246, 0.1); color: var(--primary-color); border: none;">
                    <i class="ri-volume-up-fill" style="font-size: 1.5rem;"></i>
                </button>
                
                <div style="font-size: 4.5rem; font-weight: 800; color: var(--primary-color); margin-bottom: 0; line-height: 1.2;">${word.hanzi}</div>
                <div style="font-size: 1.3rem; color: var(--text-muted); margin-bottom: 1rem;">${word.pinyin}</div>
                
                <div class="vocab-lesson-info">
                    <span style="font-size:0.85rem; font-weight: 600; color: var(--primary-color); background: rgba(139, 92, 246, 0.1); padding: 0.2rem 0.6rem; border-radius: 6px; margin-bottom: 0.5rem; display: inline-block;">${word.category}</span>
                    <div style="font-size: 1.5rem; font-weight: 700; color: var(--text-main); margin-bottom: 0.5rem;">${word.vi}</div>
                    <div style="color: var(--text-muted); font-size: 1rem; line-height: 1.5; background: rgba(0,0,0,0.02); padding: 1rem; border-radius: 12px; margin: 0 auto; max-width: 80%;">${word.example}</div>
                    
                    <div style="margin-top: 1rem;">
                        <button class="btn lesson-mark-btn" style="font-size: 1rem; padding: 0.6rem 1.5rem; border-radius: 12px; background: ${isLearned ? 'transparent' : 'rgba(16, 185, 129, 0.1)'}; color: ${isLearned ? 'var(--text-muted)' : 'var(--success)'}; border: 1px solid ${isLearned ? 'var(--border-color)' : 'transparent'};">
                            ${isLearned ? '<i class="ri-close-line"></i> Bỏ đánh dấu' : '<i class="ri-check-double-line"></i> Đã thuộc từ này'}
                        </button>
                    </div>
                </div>

                <div class="vocab-mini-test hidden" style="margin-top: 0.5rem;">
                    <p style="font-weight: 600; margin-bottom: 1rem; color: var(--text-main); font-size: 1.1rem;">Chọn nghĩa chính xác của từ này:</p>
                    <div class="mini-test-options" style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.8rem; max-width: 80%; margin: 0 auto;">
                    </div>
                </div>
            `;
            
            card.querySelector('.lesson-audio-btn').addEventListener('click', (e) => {
                speak(word.hanzi);
            });
            
            const infoDiv = card.querySelector('.vocab-lesson-info');
            const testDiv = card.querySelector('.vocab-mini-test');
            const optionsGrid = card.querySelector('.mini-test-options');
            
            card.querySelector('.lesson-mark-btn').addEventListener('click', () => {
                if (isLearned) {
                    learnedVocabIds = learnedVocabIds.filter(id => id !== word.id);
                    localStorage.setItem('hsk_learned_vocab', JSON.stringify(learnedVocabIds));
                    isLearned = false;
                    renderCardContent();
                    updateLessonProgress();
                    card.style.background = 'white';
                    card.style.border = '2px solid var(--border-color)';
                } else {
                    infoDiv.style.display = 'none';
                    testDiv.classList.remove('hidden');
                    
                    const correctVi = word.vi;
                    let wrongWords = currentVocabulary.filter(w => w.id !== word.id).sort(() => 0.5 - Math.random()).slice(0, 3);
                    let allOptions = [correctVi, ...wrongWords.map(w => w.vi)].sort(() => 0.5 - Math.random());
                    
                    optionsGrid.innerHTML = '';
                    allOptions.forEach(opt => {
                        const btn = document.createElement('button');
                        btn.className = 'btn';
                        btn.style.padding = '1.2rem';
                        btn.style.background = 'white';
                        btn.style.border = '2px solid var(--border-color)';
                        btn.style.borderRadius = '12px';
                        btn.style.fontSize = '1.1rem';
                        btn.style.fontWeight = '500';
                        btn.style.transition = 'all 0.2s';
                        btn.innerText = opt;
                        
                        btn.addEventListener('mouseenter', () => {
                            if (btn.style.background === 'white') btn.style.borderColor = 'var(--primary-color)';
                        });
                        btn.addEventListener('mouseleave', () => {
                            if (btn.style.background === 'white') btn.style.borderColor = 'var(--border-color)';
                        });
                        
                        btn.addEventListener('click', () => {
                            Array.from(optionsGrid.children).forEach(b => b.disabled = true);
                            
                            if (opt === correctVi) {
                                btn.style.background = 'var(--success)';
                                btn.style.color = 'white';
                                btn.style.borderColor = 'var(--success)';
                                
                                setTimeout(() => {
                                    learnedVocabIds.push(word.id);
                                    localStorage.setItem('hsk_learned_vocab', JSON.stringify(learnedVocabIds));
                                    isLearned = true;
                                    card.style.background = 'rgba(16, 185, 129, 0.03)';
                                    card.style.border = '2px solid rgba(16, 185, 129, 0.3)';
                                    renderCardContent();
                                    updateLessonProgress();
                                    
                                    if(currentLessonWordIndex < currentLessonWords.length - 1) {
                                        setTimeout(() => {
                                            currentLessonWordIndex++;
                                            renderActiveLessonWords();
                                        }, 800);
                                    }
                                }, 600);
                            } else {
                                btn.style.background = 'var(--danger)';
                                btn.style.color = 'white';
                                btn.style.borderColor = 'var(--danger)';
                                
                                Array.from(optionsGrid.children).forEach(b => {
                                    if (b.innerText === correctVi) {
                                        b.style.borderColor = 'var(--success)';
                                        b.style.color = 'var(--success)';
                                        b.style.fontWeight = '700';
                                    }
                                });
                                
                                setTimeout(() => {
                                    testDiv.classList.add('hidden');
                                    infoDiv.style.display = 'block';
                                }, 1500);
                            }
                        });
                        optionsGrid.appendChild(btn);
                    });
                }
            });
        };
        
        renderCardContent();
        container.appendChild(card);
        activeLessonContent.appendChild(container);
    }

    if (backBtn) {
        backBtn.addEventListener('click', () => {
            if(lessonActive) lessonActive.classList.add('hidden');
            if(lessonDashboard) lessonDashboard.classList.remove('hidden');
            
            const headerTab = document.getElementById('learn-tab-header');
            if(headerTab) headerTab.classList.remove('hidden');
            
            renderLessonGrid();
        });
    }

    if (resetProgressBtn) {
        resetProgressBtn.addEventListener('click', () => {
            if(confirm("Bạn có chắc muốn đặt lại toàn bộ tiến trình học từ vựng?")) {
                learnedVocabIds = [];
                localStorage.setItem('hsk_learned_vocab', JSON.stringify(learnedVocabIds));
                initVocabLearning();
                
                if(lessonActive && !lessonActive.classList.contains('hidden')) {
                    if(backBtn) backBtn.click();
                }
            }
        });
    }

    // Alias for tab switches
    function renderFlashcards() {
        initVocabLearning();
    }

    // Initial render
    initVocabLearning();

    // === 3. PRACTICE TAB ===
    let practiceScore = 0;
    let currentPracticeWord = null;

    function initPractice() {
        practiceScore = 0;
        document.getElementById('practice-score').innerText = practiceScore;
        nextPracticeQuestion();
    }

    function nextPracticeQuestion() {
        document.getElementById('next-practice-btn').classList.add('hidden');
        
        // Pick random word
        const rIndex = Math.floor(Math.random() * currentVocabulary.length);
        currentPracticeWord = currentVocabulary[rIndex];
        
        document.getElementById('practice-question').innerText = currentPracticeWord.hanzi;

        // Generate options (1 correct, 3 wrong)
        const options = [currentPracticeWord];
        while(options.length < 4) {
            const randomOption = currentVocabulary[Math.floor(Math.random() * currentVocabulary.length)];
            if(!options.find(opt => opt.id === randomOption.id)) {
                options.push(randomOption);
            }
        }
        
        // Shuffle options
        options.sort(() => Math.random() - 0.5);
        
        const optionsContainer = document.getElementById('practice-options');
        optionsContainer.innerHTML = '';
        
        options.forEach((opt, index) => {
            const btn = document.createElement('button');
            btn.className = 'option-btn stagger-animate';
            btn.style.animationDelay = `${index * 0.1}s`;
            btn.innerText = `${opt.vi} (${opt.pinyin})`;
            btn.dataset.id = opt.id;
            btn.addEventListener('click', () => checkPracticeAnswer(btn, opt.id));
            optionsContainer.appendChild(btn);
        });
    }

    function checkPracticeAnswer(btn, selectedId) {
        // Prevent clicking multiple times
        const allBtns = document.querySelectorAll('#practice-options .option-btn');
        allBtns.forEach(b => b.style.pointerEvents = 'none');
        
        // Speak the selected option
        const selectedWord = currentVocabulary.find(v => v.id === selectedId);
        if (selectedWord) {
            speak(selectedWord.hanzi);
        }

        if(selectedId === currentPracticeWord.id) {
            btn.classList.add('correct');
            practiceScore += 10;
            document.getElementById('practice-score').innerText = practiceScore;
        } else {
            btn.classList.add('wrong');
            // Highlight correct one
            allBtns.forEach(b => {
                if(parseInt(b.dataset.id) === currentPracticeWord.id) {
                    b.classList.add('correct');
                }
            });
        }
        
        document.getElementById('next-practice-btn').classList.remove('hidden');
    }

    document.getElementById('next-practice-btn').addEventListener('click', nextPracticeQuestion);


    // === 4. QUIZ TAB ===
    let quizQuestions = [];
    let currentQuizIndex = 0;
    let quizScore = 0;
    let currentQuizLength = 20;
    let quizTimer;
    let timeLeft = 0;
    let currentQuizSentenceMode = null;
    let quizSelectedWords = [];

    const quizIntro = document.getElementById('quiz-intro');
    const quizActive = document.getElementById('quiz-active');
    const quizResult = document.getElementById('quiz-result');

    function resetQuiz() {
        clearInterval(quizTimer);
        quizIntro.classList.remove('hidden');
        quizActive.classList.add('hidden');
        quizResult.classList.add('hidden');
    }

    document.getElementById('start-combined-quiz-btn').addEventListener('click', startQuiz);
    document.getElementById('restart-quiz-btn').addEventListener('click', startQuiz);

    function startQuiz() {
        quizIntro.classList.add('hidden');
        quizResult.classList.add('hidden');
        quizActive.classList.remove('hidden');
        document.getElementById('quiz-timeout-msg').classList.add('hidden');
        
        quizScore = 0;
        currentQuizIndex = 0;
        
        let combinedData = [];
        
        // Create pools
        let vocabPool = currentVocabulary ? [...currentVocabulary].sort(() => 0.5 - Math.random()) : [];
        let sentencePool = currentSentences ? [...currentSentences].sort(() => 0.5 - Math.random()) : [];
        
        // Distribute up to 20 questions (5 of each if possible)
        vocabPool.splice(0, 5).forEach(item => combinedData.push({ ...item, qType: 'reading' }));
        vocabPool.splice(0, 5).forEach(item => combinedData.push({ ...item, qType: 'listening' }));
        vocabPool.splice(0, 5).forEach(item => combinedData.push({ ...item, qType: 'speaking' }));
        sentencePool.splice(0, 5).forEach(item => combinedData.push({ ...item, qType: 'writing' }));
        
        currentQuizLength = combinedData.length;
        if (currentQuizLength === 0) return;
        
        timeLeft = 600; // 10 phút (600 giây)
        
        const shuffled = combinedData.sort(() => 0.5 - Math.random());
        quizQuestions = shuffled;
        
        // Start Timer
        clearInterval(quizTimer);
        timeLeft = currentQuizLength * 10;
        document.getElementById('quiz-time-left').innerText = timeLeft;
        quizTimer = setInterval(() => {
            timeLeft--;
            document.getElementById('quiz-time-left').innerText = timeLeft;
            if (timeLeft <= 0) {
                clearInterval(quizTimer);
                finishQuiz(true);
            }
        }, 1000);
        
        if (currentQuizLength > 0) {
            showQuizQuestion();
        } else {
            finishQuiz();
        }
    }

    function renderQuizPalette() {
        const palette = document.getElementById('quiz-palette');
        if (!palette) return;
        palette.innerHTML = '';
        quizQuestions.forEach((q, index) => {
            const btn = document.createElement('button');
            btn.className = 'palette-btn';
            btn.style.padding = '8px 4px';
            btn.style.borderRadius = '8px';
            btn.style.border = '1px solid var(--border-color)';
            btn.style.background = (q.userAnswer !== undefined && q.userAnswer !== '') ? 'var(--primary-color)' : 'var(--surface-color)';
            btn.style.color = (q.userAnswer !== undefined && q.userAnswer !== '') ? 'white' : 'var(--text-main)';
            btn.style.fontWeight = '600';
            btn.style.cursor = 'pointer';
            btn.innerText = index + 1;
            
            if (index === currentQuizIndex) {
                btn.style.border = '2px solid var(--danger)';
                btn.style.transform = 'scale(1.1)';
            }
            
            btn.addEventListener('click', () => {
                if (quizIsRecording) stopQuizRecording();
                currentQuizIndex = index;
                showQuizQuestion();
            });
            
            palette.appendChild(btn);
        });
    }

    function showQuizQuestion() {
        const qNum = currentQuizIndex + 1;
        document.getElementById('quiz-current-num').innerText = qNum;
        const totalNumEl = document.getElementById('quiz-total-num');
        if (totalNumEl) totalNumEl.innerText = currentQuizLength;
        document.getElementById('quiz-progress-fill').style.width = `${(qNum / currentQuizLength) * 100}%`;

        renderQuizPalette();

        const q = quizQuestions[currentQuizIndex];
        
        // Reset UI
        document.getElementById('quiz-vocab-area').classList.add('hidden');
        document.getElementById('quiz-sentence-area').classList.add('hidden');
        document.getElementById('quiz-speaking-area').classList.add('hidden');
        document.getElementById('quiz-question-text').innerText = '';
        document.getElementById('quiz-question-audio').classList.add('hidden');

        if (q.qType === 'reading' || q.qType === 'listening') {
            document.getElementById('quiz-vocab-area').classList.remove('hidden');
            const optionsContainer = document.getElementById('quiz-options');
            optionsContainer.innerHTML = '';
            
            if (q.qType === 'reading') {
                document.getElementById('quiz-question-text').innerText = q.hanzi;
            } else {
                document.getElementById('quiz-question-audio').classList.remove('hidden');
                // Automatically play audio for listening questions
                speak(q.hanzi);
            }

            // Ensure options are constant for this question
            if (!q.options) {
                const options = [q];
                while (options.length < 4 && options.length < currentVocabulary.length) {
                    const randomOption = currentVocabulary[Math.floor(Math.random() * currentVocabulary.length)];
                    if (!options.find(opt => opt.id === randomOption.id)) {
                        options.push(randomOption);
                    }
                }
                options.sort(() => Math.random() - 0.5);
                q.options = options;
            }

            q.options.forEach(opt => {
                const btn = document.createElement('button');
                btn.className = 'option-btn';
                btn.innerText = opt.vi;
                if (q.userAnswer === opt.id) {
                    btn.style.borderColor = 'var(--primary-color)';
                    btn.style.background = 'rgba(79, 70, 229, 0.1)';
                }
                btn.addEventListener('click', () => handleQuizVocabAnswer(btn, opt.id));
                optionsContainer.appendChild(btn);
            });
            
        } else if (q.qType === 'speaking') {
            document.getElementById('quiz-speaking-area').classList.remove('hidden');
            document.getElementById('quiz-speaking-text').innerText = q.hanzi;
            
            const feedbackEl = document.getElementById('quiz-speaking-feedback');
            if (q.userAnswer) {
                feedbackEl.innerText = `Đã thu âm: ${q.userAnswer}`;
                feedbackEl.style.color = 'var(--primary-color)';
            } else {
                feedbackEl.innerText = '';
            }
            if (quizIsRecording) stopQuizRecording();
            
        } else if (q.qType === 'writing') {
            document.getElementById('quiz-sentence-area').classList.remove('hidden');
            document.getElementById('quiz-check-btn').classList.remove('hidden');
            
            if (!q.writeMode) {
                q.writeMode = Math.random() > 0.5 ? 'sort' : 'translate';
            }
            currentQuizSentenceMode = q.writeMode;
            
            const modeTitle = document.getElementById('quiz-sentence-mode-title');
            const questionEl = document.getElementById('quiz-sentence-question');
            const sortArea = document.getElementById('quiz-sentence-sorting-area');
            const transArea = document.getElementById('quiz-sentence-translation-area');
            
            document.getElementById('quiz-sentence-feedback').innerText = '';
            document.getElementById('quiz-sentence-feedback').className = 'feedback-msg';
            
            if (currentQuizSentenceMode === 'sort') {
                modeTitle.innerText = "Sắp xếp câu";
                questionEl.innerText = q.vietnamese;
                sortArea.classList.remove('hidden');
                transArea.classList.add('hidden');
                setupQuizSorting(q);
            } else {
                modeTitle.innerText = "Dịch thuật";
                questionEl.innerText = q.vietnamese;
                sortArea.classList.add('hidden');
                transArea.classList.remove('hidden');
                
                const inputEl = document.getElementById('quiz-translation-input');
                inputEl.value = q.userAnswer || '';
                inputEl.disabled = false;
                setTimeout(() => inputEl.focus(), 100);
            }
        }
    }

    document.getElementById('quiz-translation-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            document.getElementById('quiz-check-btn').click();
        }
    });

    function setupQuizSorting(q) {
        const dropZone = document.getElementById('quiz-word-drop-zone');
        const wordOptions = document.getElementById('quiz-word-options');
        dropZone.innerHTML = '';
        wordOptions.innerHTML = '';
        
        quizSelectedWords = q.userAnswer ? q.userAnswer.split('').map(w => ({ word: w, index: -1 })) : [];
        
        // Setup options
        const shuffledWords = [...q.words].sort(() => 0.5 - Math.random());
        shuffledWords.forEach((word, index) => {
            const wordEl = document.createElement('div');
            wordEl.className = 'word-block';
            wordEl.innerText = word;
            wordEl.dataset.index = index;
            
            wordEl.addEventListener('click', () => {
                if (!wordEl.classList.contains('hidden-word')) {
                    wordEl.classList.add('hidden-word');
                    quizSelectedWords.push({ word, index });
                    renderQuizDropZone();
                }
            });
            wordOptions.appendChild(wordEl);
        });
        
        renderQuizDropZone();
    }

    function renderQuizDropZone() {
        const dropZone = document.getElementById('quiz-word-drop-zone');
        const wordOptions = document.getElementById('quiz-word-options');
        dropZone.innerHTML = '';
        quizSelectedWords.forEach((item, arrIndex) => {
            const wordEl = document.createElement('div');
            wordEl.className = 'word-block';
            wordEl.innerText = item.word;
            
            wordEl.addEventListener('click', () => {
                quizSelectedWords.splice(arrIndex, 1);
                if (item.index !== -1) {
                    const optionEl = wordOptions.querySelector(`[data-index="${item.index}"]`);
                    if (optionEl) optionEl.classList.remove('hidden-word');
                }
                renderQuizDropZone();
            });
            dropZone.appendChild(wordEl);
        });
    }

    document.getElementById('quiz-check-btn').addEventListener('click', () => {
        const q = quizQuestions[currentQuizIndex];
        const transInput = document.getElementById('quiz-translation-input');
        
        if (currentQuizSentenceMode === 'sort') {
            const userSentence = quizSelectedWords.map(i => i.word).join('');
            q.userAnswer = userSentence;
        } else if (currentQuizSentenceMode === 'translate') {
            q.userAnswer = transInput.value.trim();
        }
        
        renderQuizPalette();
        const feedback = document.getElementById('quiz-sentence-feedback');
        feedback.innerText = "Đã lưu đáp án!";
        feedback.className = 'feedback-msg success';
        
        setTimeout(() => moveNextQuizQuestion(), 800);
    });

    function handleQuizVocabAnswer(btn, selectedId) {
        const q = quizQuestions[currentQuizIndex];
        q.userAnswer = selectedId;
        
        const allBtns = document.querySelectorAll('#quiz-options .option-btn');
        allBtns.forEach(b => {
            b.style.borderColor = 'var(--border-color)';
            b.style.background = 'white';
        });
        btn.style.borderColor = 'var(--primary-color)';
        btn.style.background = 'rgba(79, 70, 229, 0.1)';
        
        renderQuizPalette();
        setTimeout(() => moveNextQuizQuestion(), 300);
    }

    function moveNextQuizQuestion() {
        if (currentQuizIndex < currentQuizLength - 1) {
            currentQuizIndex++;
            showQuizQuestion();
        }
    }

    // --- Quiz Navigation Buttons ---
    document.getElementById('quiz-prev-btn')?.addEventListener('click', () => {
        if (quizIsRecording) stopQuizRecording();
        if (currentQuizIndex > 0) {
            currentQuizIndex--;
            showQuizQuestion();
        }
    });

    document.getElementById('quiz-next-btn')?.addEventListener('click', () => {
        if (quizIsRecording) stopQuizRecording();
        moveNextQuizQuestion();
    });

    document.getElementById('quiz-submit-exam-btn')?.addEventListener('click', () => {
        if (quizIsRecording) stopQuizRecording();
        if (confirm("Bạn có chắc chắn muốn nộp bài? Những câu chưa làm sẽ không có điểm.")) {
            finishQuiz(false);
        }
    });

    function finishQuiz(isTimeout = false) {
        clearInterval(quizTimer);
        quizActive.classList.add('hidden');
        quizResult.classList.remove('hidden');
        
        if (isTimeout) {
            document.getElementById('quiz-timeout-msg').classList.remove('hidden');
        } else {
            document.getElementById('quiz-timeout-msg').classList.remove('hidden');
        }
        
        quizScore = 0;
        const normalize = (str) => str.replace(/[.,!?，。！？；：'"、\s]/g, '').toLowerCase();
        
        quizQuestions.forEach(q => {
            q.isCorrect = false;
            if (!q.userAnswer) return;
            
            if (q.qType === 'reading' || q.qType === 'listening') {
                if (q.userAnswer === q.id) {
                    quizScore++;
                    q.isCorrect = true;
                }
            } else if (q.qType === 'writing') {
                const normAns = normalize(q.userAnswer);
                const normCorrect = normalize(q.chinese);
                if (normAns === normCorrect) {
                    quizScore++;
                    q.isCorrect = true;
                }
            } else if (q.qType === 'speaking') {
                const normAns = normalize(q.userAnswer);
                const normCorrect = normalize(q.hanzi);
                if (normAns === normCorrect || normAns.includes(normCorrect)) {
                    quizScore++;
                    q.isCorrect = true;
                }
            }
        });
        
        const percentage = Math.round((quizScore / currentQuizLength) * 100);
        document.getElementById('quiz-final-score').innerText = `${percentage}%`;
        document.getElementById('quiz-result-msg').innerText = `Bạn đã trả lời đúng ${quizScore}/${currentQuizLength} câu.`;
        
        if (percentage >= 80) shootConfetti();
        
        const titleEl = document.getElementById('quiz-result-title');
        if(percentage >= 80) {
            titleEl.innerText = "Xuất Sắc! 🎉";
            titleEl.style.color = "var(--success)";
        } else if(percentage >= 60) {
            titleEl.innerText = "Khá Tốt! 👍";
            titleEl.style.color = "var(--primary-color)";
        } else {
            titleEl.innerText = "Cố gắng lên! 💪";
            titleEl.style.color = "var(--danger)";
        }
        
        renderQuizReview();
    }
    
    function renderQuizReview() {
        const container = document.getElementById('quiz-detailed-results');
        if (!container) return;
        container.innerHTML = '';
        
        const filterWrong = document.getElementById('quiz-filter-wrong').checked;
        
        quizQuestions.forEach((q, index) => {
            if (filterWrong && q.isCorrect) return;
            
            const card = document.createElement('div');
            card.className = 'stagger-animate';
            card.style.animationDelay = `${index * 0.1}s`;
            card.style.background = 'var(--surface-color)';
            card.style.border = '1px solid var(--border-color)';
            card.style.borderRadius = '12px';
            card.style.padding = '1.5rem';
            
            let qTypeStr = '';
            let questionContent = '';
            let correctAnsStr = '';
            let userAnsStr = q.userAnswer ? `<b style="color: var(--text-main);">${q.userAnswer}</b>` : '<b style="color:var(--text-muted)">Không trả lời</b>';
            let reasonStr = '';
            let grammarStr = '';

            if (q.qType === 'reading') {
                qTypeStr = 'Đọc hiểu';
                questionContent = `<div style="font-size: 1.5rem; color: var(--primary-color);">${q.hanzi}</div>`;
                correctAnsStr = `${q.hanzi} (${q.pinyin}) - ${q.vi}`;
                
                if (q.userAnswer && q.options) {
                    const chosen = q.options.find(opt => opt.id === q.userAnswer);
                    if (chosen) {
                        userAnsStr = `<b style="color: var(--text-main);">${chosen.hanzi} (${chosen.pinyin}) - ${chosen.vi}</b>`;
                        reasonStr = `Từ bạn chọn có nghĩa là "${chosen.vi}", nhưng đáp án đúng phải là "${q.vi}".`;
                    }
                } else if (!q.userAnswer) {
                    reasonStr = "Bạn chưa chọn đáp án nào.";
                }
                grammarStr = q.example ? `<b>Ví dụ:</b> ${q.example}` : '';
            } else if (q.qType === 'listening') {
                qTypeStr = 'Nghe hiểu';
                questionContent = `<div style="font-size: 1.2rem; color: var(--primary-color);"><i class="ri-volume-up-fill"></i> ${q.hanzi}</div>`;
                correctAnsStr = `${q.hanzi} (${q.pinyin}) - ${q.vi}`;
                
                if (q.userAnswer && q.options) {
                    const chosen = q.options.find(opt => opt.id === q.userAnswer);
                    if (chosen) {
                        userAnsStr = `<b style="color: var(--text-main);">${chosen.hanzi} (${chosen.pinyin}) - ${chosen.vi}</b>`;
                        reasonStr = `Âm thanh phát ra là từ "${q.hanzi} (${q.pinyin})", nhưng bạn lại chọn từ "${chosen.hanzi} (${chosen.pinyin})".`;
                    }
                } else if (!q.userAnswer) {
                    reasonStr = "Bạn chưa chọn đáp án nào.";
                }
                grammarStr = q.example ? `<b>Ví dụ:</b> ${q.example}` : '';
            } else if (q.qType === 'speaking') {
                qTypeStr = 'Nói';
                questionContent = `<div style="font-size: 1.5rem; color: var(--primary-color);">${q.hanzi}</div>`;
                correctAnsStr = `${q.hanzi} (${q.pinyin}) - ${q.vi}`;
                if (!q.userAnswer) {
                    reasonStr = "Bạn chưa thu âm hoặc hệ thống không nhận diện được giọng nói.";
                } else {
                    reasonStr = "Phát âm của bạn chưa khớp hoàn toàn với chữ Hán hoặc Pinyin chuẩn.";
                }
                grammarStr = q.example ? `<b>Ví dụ:</b> ${q.example}` : '';
            } else if (q.qType === 'writing') {
                qTypeStr = 'Viết / Sắp xếp câu';
                questionContent = `<div style="font-size: 1.2rem; color: var(--text-main);">${q.vietnamese}</div>`;
                correctAnsStr = `${q.chinese} (${q.pinyin})`;
                if (!q.userAnswer) {
                    reasonStr = "Bạn chưa hoàn thành câu này.";
                } else {
                    reasonStr = "Bạn sắp xếp sai trật tự từ hoặc dịch chưa chính xác.";
                }
                grammarStr = getGrammarExplanation(q.chinese);
            }
            
            const statusIcon = q.isCorrect 
                ? '<span style="color: var(--success); font-weight: 600;"><i class="ri-checkbox-circle-fill"></i> Đúng</span>'
                : '<span style="color: var(--danger); font-weight: 600;"><i class="ri-close-circle-fill"></i> Sai / Bỏ trống</span>';
            
            let html = `
                <div style="display: flex; justify-content: space-between; margin-bottom: 1rem; border-bottom: 1px dashed var(--border-color); padding-bottom: 0.5rem;">
                    <span style="font-weight: 600; color: var(--text-muted);">Câu ${index + 1} &bull; ${qTypeStr}</span>
                    ${statusIcon}
                </div>
                <div style="margin-bottom: 1rem;">${questionContent}</div>
                <div style="margin-bottom: 0.5rem; color: var(--text-muted);">Bạn chọn/nhập: ${userAnsStr}</div>
            `;
            
            if (!q.isCorrect) {
                html += `
                    <div style="color: var(--danger); background: rgba(239, 68, 68, 0.05); padding: 0.75rem 1rem; border-radius: 8px; margin-top: 0.5rem; font-size: 0.95rem; line-height: 1.5;">
                        <span style="display:block; margin-bottom: 0.25rem;"><b style="color: var(--danger);">Lý do sai:</b> <span style="color: var(--text-main);">${reasonStr}</span></span>
                    </div>
                `;
            }
            
            html += `
                <div style="color: var(--success); background: rgba(34, 197, 94, 0.1); padding: 0.75rem 1rem; border-radius: 8px; margin-top: 0.5rem; font-size: 0.95rem; line-height: 1.5;">
                    <span style="display:block; margin-bottom: 0.25rem;"><b>Đáp án chuẩn:</b> <span style="color: var(--text-main);">${correctAnsStr}</span></span>
                    ${grammarStr ? `<span style="display:block; margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px dashed rgba(34, 197, 94, 0.3);"><b>Giải thích:</b> <span style="color: var(--text-main);">${grammarStr}</span></span>` : ''}
                </div>
            `;
            
            card.innerHTML = html;
            container.appendChild(card);
        });
    }

    document.getElementById('quiz-filter-wrong')?.addEventListener('change', renderQuizReview);
    
    // --- Quiz Audio Listener ---
    document.getElementById('quiz-question-audio').addEventListener('click', () => {
        const q = quizQuestions[currentQuizIndex];
        if (q && q.qType === 'listening') {
            speak(q.hanzi);
        }
    });

    // --- Quiz Speaking Recognition ---
    let quizRecognition = null;
    let quizIsRecording = false;
    let quizAccumulatedTranscript = "";

    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        quizRecognition = new SpeechRecognition();
        quizRecognition.lang = 'zh-CN';
        quizRecognition.continuous = true;
        quizRecognition.interimResults = false;
        
        quizRecognition.onresult = (event) => {
            let transcript = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
                transcript += event.results[i][0].transcript;
            }
            quizAccumulatedTranscript += transcript;
            processQuizSpeechResult(quizAccumulatedTranscript);
        };
        
        quizRecognition.onerror = (event) => {
            stopQuizRecording();
            const feedbackEl = document.getElementById('quiz-speaking-feedback');
            feedbackEl.innerText = "Lỗi thu âm. Bạn có thể thử lại.";
            feedbackEl.style.color = "var(--danger)";
        };
        
        quizRecognition.onend = () => {
            if (quizIsRecording) stopQuizRecording();
        };
    }

    function startQuizRecording() {
        if (!quizRecognition) {
            alert('Trình duyệt không hỗ trợ nhận diện giọng nói.');
            return;
        }
        quizIsRecording = true;
        quizAccumulatedTranscript = "";
        const btn = document.getElementById('quiz-record-btn');
        btn.innerHTML = '<i class="ri-stop-circle-line"></i> Dừng thu âm';
        btn.style.background = 'var(--danger)';
        btn.style.color = 'white';
        
        const feedbackEl = document.getElementById('quiz-speaking-feedback');
        feedbackEl.innerText = "Đang nghe...";
        feedbackEl.style.color = "var(--primary-color)";
        
        try {
            quizRecognition.start();
        } catch(e) {}
    }

    function stopQuizRecording() {
        quizIsRecording = false;
        const btn = document.getElementById('quiz-record-btn');
        btn.innerHTML = '<i class="ri-mic-line"></i> Bắt đầu thu âm';
        btn.style.background = 'rgba(239, 68, 68, 0.1)';
        btn.style.color = 'var(--danger)';
        
        if (quizRecognition) {
            try {
                quizRecognition.stop();
            } catch(e) {}
        }
    }

    function processQuizSpeechResult(transcript) {
        if (!transcript) return;
        
        const q = quizQuestions[currentQuizIndex];
        q.userAnswer = transcript; // Save answer
        
        const feedbackEl = document.getElementById('quiz-speaking-feedback');
        feedbackEl.innerText = `Đã thu âm: ${transcript}`;
        feedbackEl.style.color = 'var(--primary-color)';
        
        renderQuizPalette();
        stopQuizRecording();
        
        setTimeout(() => moveNextQuizQuestion(), 800);
    }

    document.getElementById('quiz-record-btn').addEventListener('click', () => {
        if (quizIsRecording) stopQuizRecording();
        else startQuizRecording();
    });

    // === 5. SENTENCE TAB ===
    let currentSentenceData = null;
    let currentSentenceMode = 'sort'; // 'sort' or 'translate'
    let selectedWords = [];

    const sentenceModeTitle = document.getElementById('sentence-mode-title');
    const sentenceQuestion = document.getElementById('sentence-question');
    const sortingArea = document.getElementById('sentence-sorting-area');
    const dropZone = document.getElementById('word-drop-zone');
    const wordOptions = document.getElementById('word-options');
    const translationArea = document.getElementById('sentence-translation-area');
    const translationInput = document.getElementById('translation-input');
    const translationFeedback = document.getElementById('translation-feedback');

    function initSentencePractice() {
        if (!currentSentences || currentSentences.length === 0) {
            sentenceQuestion.innerText = "Chưa có dữ liệu câu cho cấp độ này.";
            sortingArea.classList.add('hidden');
            translationArea.classList.add('hidden');
            return;
        }
        nextSentence();
    }

    function nextSentence() {
        document.getElementById('check-sentence-btn').classList.remove('hidden');
        document.getElementById('next-sentence-btn').classList.add('hidden');
        document.getElementById('sentence-grammar-analysis').classList.add('hidden');
        translationFeedback.innerText = '';
        translationFeedback.className = 'feedback-msg';
        translationInput.value = '';
        translationInput.classList.remove('hidden'); // Ensure it's not hidden from previous sort mode
        selectedWords = [];
        dropZone.innerHTML = '';

        // Pick random sentence
        const rIndex = Math.floor(Math.random() * currentSentences.length);
        currentSentenceData = currentSentences[rIndex];

        // Random mode 50/50
        currentSentenceMode = Math.random() > 0.5 ? 'sort' : 'translate';

        if (currentSentenceMode === 'sort') {
            setupSortMode();
        } else {
            setupTranslateMode();
        }
    }

    function setupSortMode() {
        sentenceModeTitle.innerText = "Chế độ: Sắp xếp câu";
        sentenceQuestion.innerText = currentSentenceData.vietnamese;
        sortingArea.classList.remove('hidden');
        translationArea.classList.add('hidden');
        
        // Shuffle words
        const shuffledWords = [...currentSentenceData.words].sort(() => 0.5 - Math.random());
        wordOptions.innerHTML = '';
        
        shuffledWords.forEach((word, index) => {
            const wordEl = document.createElement('div');
            wordEl.className = 'word-block stagger-animate';
            wordEl.style.animationDelay = `${index * 0.1}s`;
            wordEl.innerText = word;
            wordEl.dataset.index = index;
            
            wordEl.addEventListener('click', () => {
                if (!wordEl.classList.contains('hidden-word')) {
                    // Move to drop zone
                    wordEl.classList.add('hidden-word');
                    selectedWords.push({ word, index });
                    renderDropZone();
                }
            });
            
            wordOptions.appendChild(wordEl);
        });
    }

    function renderDropZone() {
        dropZone.innerHTML = '';
        selectedWords.forEach((item, arrIndex) => {
            const wordEl = document.createElement('div');
            wordEl.className = 'word-block stagger-animate';
            wordEl.style.animationDelay = `${arrIndex * 0.1}s`;
            wordEl.innerText = item.word;
            
            wordEl.addEventListener('click', () => {
                // Remove from drop zone
                selectedWords.splice(arrIndex, 1);
                // Unhide in options
                const optionEl = wordOptions.querySelector(`[data-index="${item.index}"]`);
                if (optionEl) optionEl.classList.remove('hidden-word');
                renderDropZone();
            });
            
            wordEl.appendChild(wordEl);
        });
    }

    function setupTranslateMode() {
        sortingArea.classList.add('hidden');
        translationArea.classList.remove('hidden');
        
        // 50/50 vi->zh or zh->vi
        if (Math.random() > 0.5) {
            currentSentenceMode = 'translate_vi_zh';
            sentenceModeTitle.innerText = "Chế độ: Dịch sang Tiếng Trung";
            sentenceQuestion.innerText = currentSentenceData.vietnamese;
            translationInput.placeholder = "Nhập chữ Hán hoặc Pinyin...";
        } else {
            currentSentenceMode = 'translate_zh_vi';
            sentenceModeTitle.innerText = "Chế độ: Dịch sang Tiếng Việt";
            sentenceQuestion.innerText = currentSentenceData.chinese;
            translationInput.placeholder = "Nhập nghĩa tiếng Việt...";
        }
    }

    function checkSentence() {
        let isCorrect = false;
        let correctAnswer = "";

        if (currentSentenceMode === 'sort') {
            const userSentence = selectedWords.map(i => i.word).join('');
            correctAnswer = currentSentenceData.chinese;
            
            // Remove punctuation and spaces for comparison
            const normalize = (str) => str.replace(/[.,!?，。！？；：'"、\s]/g, '');
            isCorrect = (normalize(userSentence) === normalize(correctAnswer));
        } else if (currentSentenceMode === 'translate_vi_zh') {
            const userInput = translationInput.value;
            
            // Helper to remove tones, spaces, and punctuation
            const normalizePinyin = (str) => {
                return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Remove accents/tones
                          .toLowerCase()
                          .replace(/[.,!?，。！？；：'"、\s]/g, ''); // Remove punctuation and spaces
            };
            
            const pinyinNormalized = normalizePinyin(currentSentenceData.pinyin);
            const inputNormalized = normalizePinyin(userInput);
            
            // Also check against pure Chinese characters (ignoring punctuation)
            const chineseNormalized = currentSentenceData.chinese.replace(/[.,!?，。！？；：'"、\s]/g, '');
            
            correctAnswer = `${currentSentenceData.chinese} (${currentSentenceData.pinyin})`;
            isCorrect = (inputNormalized === chineseNormalized || inputNormalized === pinyinNormalized);
        } else if (currentSentenceMode === 'translate_zh_vi') {
            const userInput = translationInput.value;
            correctAnswer = currentSentenceData.vietnamese;
            
            // Normalize strings for comparison (remove punctuation and spaces)
            const normalize = (str) => str.toLowerCase().replace(/[.,!?，。！？；：'"、\s]/g, '');
            const inputNormalized = normalize(userInput);
            
            // Allow matching any part separated by '/'
            const possibleAnswers = correctAnswer.split('/').map(ans => normalize(ans));
            isCorrect = possibleAnswers.includes(inputNormalized);
        }

        let feedbackHTML = isCorrect 
            ? `<div style="font-weight:bold; margin-bottom: 0.5rem;">Chính xác! 🎉</div>`
            : `<div style="font-weight:bold; margin-bottom: 0.5rem;">Sai rồi. Đáp án đúng là: <span style="color:var(--primary-color);">${correctAnswer}</span></div>`;
        
        feedbackHTML += `
            <div style="font-size: 1.1rem; color: var(--primary-color); margin-top: 0.5rem;">${currentSentenceData.pinyin}</div>
            <div style="font-size: 0.95rem; color: var(--text-main); margin-top: 0.25rem;">${currentSentenceData.vietnamese}</div>
        `;

        translationFeedback.innerHTML = feedbackHTML;
        translationFeedback.className = isCorrect ? 'feedback-msg success' : 'feedback-msg error';

        // Show feedback in sorting mode too by hijacking the element
        if (currentSentenceMode === 'sort') {
            translationArea.classList.remove('hidden');
            translationInput.classList.add('hidden'); // Hide input
        } else {
            translationInput.classList.remove('hidden');
        }

        document.getElementById('check-sentence-btn').classList.add('hidden');
        document.getElementById('next-sentence-btn').classList.remove('hidden');
        
        // --- Grammar Analysis ---
        const analysisArea = document.getElementById('sentence-grammar-analysis');
        const analysisContent = document.getElementById('grammar-analysis-content');
        analysisArea.classList.remove('hidden');
        
        analysisContent.innerHTML = getGrammarExplanation(currentSentenceData.chinese);
    }

    function getGrammarExplanation(sentence) {
        const rules = [
            { match: "是因为", explanation: "<b>Cấu trúc nguyên nhân - kết quả:</b> ...是因为... (sở dĩ... là bởi vì...)." },
            { match: "为什么", explanation: "<b>Đại từ nghi vấn 为什么 (wèishénme):</b> Hỏi về nguyên nhân (Tại sao)." },
            { match: "因为", explanation: "<b>Cấu trúc nguyên nhân:</b> 因为 (yīnwèi - bởi vì)... 所以 (suǒyǐ - cho nên)..." },
            { match: "所以", explanation: "<b>Cấu trúc kết quả:</b> 因为 (yīnwèi - bởi vì)... 所以 (suǒyǐ - cho nên)..." },
            { match: "虽然", explanation: "<b>Cấu trúc nhượng bộ:</b> 虽然 (suīrán - mặc dù)... 但是 (dànshì - nhưng)..." },
            { match: "但是", explanation: "<b>Cấu trúc chuyển ý:</b> 但是 (dànshì - nhưng / tuy nhiên)..." },
            { match: "不但", explanation: "<b>Cấu trúc tăng tiến:</b> 不但 (búdàn - không những)... 而且 (érqiě - mà còn)..." },
            { match: "而且", explanation: "<b>Cấu trúc tăng tiến:</b> ...而且 (érqiě - mà còn)..." },
            { match: "如果", explanation: "<b>Cấu trúc giả thiết:</b> 如果 (rúguǒ - nếu như)... 就 (jiù - thì)..." },
            { match: "越来越", explanation: "<b>Cấu trúc:</b> 越来越... (yuè lái yuè...): Ngày càng..." },
            { match: "正在", explanation: "<b>Phó từ 正在 (zhèngzài):</b> Nhấn mạnh hành động đang diễn ra (Đang...)." },
            { match: "在", regex: /在.*呢/, explanation: "<b>Cấu trúc đang tiếp diễn:</b> 在...呢 (zài...ne) biểu thị hành động đang xảy ra." },
            { match: "在", explanation: "<b>Giới từ 在 (zài):</b> Dùng trước danh từ để chỉ địa điểm (Ở / Tại...)." },
            { match: "是", regex: /是.*的/, explanation: "<b>Cấu trúc 是...的 (shì...de):</b> Dùng để nhấn mạnh thời gian, địa điểm, mục đích, phương thức." },
            { match: "的", explanation: "<b>Trợ từ kết cấu 的 (de):</b> Đứng giữa định ngữ và trung tâm ngữ (N1 + 的 + N2). Nghĩa là 'Của' hoặc dùng để mô tả." },
            { match: "比", explanation: "<b>Cấu trúc so sánh:</b> A + 比 (bǐ) + B + Tính từ (A hơn B...)." },
            { match: "把", explanation: "<b>Câu chữ 把 (bǎ):</b> S + 把 + O + Động từ + Thành phần khác. Dùng để nhấn mạnh sự tác động đối với tân ngữ." },
            { match: "被", explanation: "<b>Câu bị động với 被 (bèi):</b> O + 被 + S + Động từ + Thành phần khác. Chủ ngữ là đối tượng tiếp nhận hành động." },
            { match: "会", explanation: "<b>Động từ năng nguyện 会 (huì):</b> Chỉ khả năng (biết làm gì nhờ học tập) hoặc khả năng xảy ra trong tương lai (sẽ)." },
            { match: "能", explanation: "<b>Động từ năng nguyện 能 (néng):</b> Chỉ khả năng, năng lực hiện tại có thể làm được việc gì đó." },
            { match: "可以", explanation: "<b>Động từ năng nguyện 可以 (kěyǐ):</b> Chỉ sự cho phép (Có thể / Được phép)." },
            { match: "过", explanation: "<b>Trợ từ động thái 过 (guo):</b> Đứng sau động từ để diễn tả một trải nghiệm trong quá khứ (Đã từng...)." },
            { match: "着", explanation: "<b>Trợ từ động thái 着 (zhe):</b> Đứng sau động từ để diễn tả trạng thái đang tiếp diễn của hành động." },
            { match: "得", explanation: "<b>Bổ ngữ trạng thái 得 (de):</b> Động từ + 得 + Tính từ. Dùng để đánh giá mức độ của hành động." },
            { match: "就", explanation: "<b>Phó từ 就 (jiù):</b> Biểu thị hành động xảy ra sớm, nhanh, hoặc kết luận (Liền / Thì / Bèn)." },
            { match: "才", explanation: "<b>Phó từ 才 (cái):</b> Biểu thị hành động xảy ra muộn, chậm hoặc khó khăn mới đạt được (Mới)." },
            { match: "给", explanation: "<b>Giới từ 给 (gěi):</b> Cho, làm gì đó cho ai (A 给 B + Động từ)." },
            { match: "向", explanation: "<b>Giới từ 向 (xiàng):</b> Hướng về, về phía (hướng của hành động)." },
            { match: "从", explanation: "<b>Giới từ 从 (cóng):</b> Từ (chỉ điểm xuất phát về thời gian, địa điểm)." },
            { match: "离", explanation: "<b>Giới từ 离 (lí):</b> Cách (dùng để nói về khoảng cách giữa 2 địa điểm hoặc thời gian)." },
            { match: "多", regex: /多(少|大|长)/, explanation: "<b>Đại từ nghi vấn 多 (duō):</b> Đứng trước tính từ để hỏi về mức độ (Bao nhiêu / Bao lâu...)." },
            { match: "怎么", explanation: "<b>Đại từ nghi vấn 怎么 (zěnme):</b> Hỏi về phương thức hoặc nguyên nhân (Thế nào / Làm sao)." },
            { match: "什么", explanation: "<b>Đại từ nghi vấn 什么 (shénme):</b> Hỏi về sự vật, sự việc (Cái gì)." },
            { match: "吗", explanation: "<b>Trợ từ nghi vấn 吗 (ma):</b> Đứng cuối câu để tạo câu hỏi Có/Không." },
            { match: "呢", explanation: "<b>Trợ từ nghi vấn 呢 (ne):</b> Đứng cuối câu để hỏi ngược lại hoặc nhấn mạnh trạng thái." },
            { match: "吧", explanation: "<b>Trợ từ ngữ khí 吧 (ba):</b> Đứng cuối câu để rủ rê, đề nghị hoặc suy đoán." },
            { match: "了", explanation: "<b>Trợ từ động thái 了 (le):</b> Đứng cuối câu hoặc sau động từ biểu thị hành động đã hoàn thành." },
            { match: "都", explanation: "<b>Phó từ 都 (dōu):</b> Biểu thị phạm vi toàn bộ (Đều / Tất cả)." },
            { match: "也", explanation: "<b>Phó từ 也 (yě):</b> Biểu thị sự tương đồng (Cũng)." },
            { match: "很", explanation: "<b>Phó từ chỉ mức độ 很 (hěn):</b> Đứng trước tính từ (Rất)." },
            { match: "最", explanation: "<b>Phó từ chỉ mức độ 最 (zuì):</b> Biểu thị mức độ cao nhất (Nhất)." },
            { match: "真", explanation: "<b>Phó từ chỉ mức độ 真 (zhēn):</b> Biểu thị cảm xúc, cảm thán (Thật là / Quả thật)." },
            { match: "太", regex: /太.*了/, explanation: "<b>Phó từ chỉ mức độ 太...了 (tài...le):</b> Biểu thị mức độ cao (Quá / Lắm)." }
        ];

        let explanation = "";
        for (let rule of rules) {
            if (rule.regex) {
                if (rule.regex.test(sentence)) {
                    explanation += rule.explanation + "<br><br>";
                }
            } else {
                if (sentence.includes(rule.match)) {
                    explanation += rule.explanation + "<br><br>";
                }
            }
        }
        
        if (!explanation) {
            if (sentence.includes('?') || sentence.includes('？')) {
                explanation = "<b>Cấu trúc câu hỏi cơ bản:</b> Sử dụng từ để hỏi hoặc trợ từ nghi vấn, giữ nguyên trật tự câu.";
            } else {
                explanation = "<b>Cấu trúc câu trần thuật cơ bản:</b> Chủ ngữ + (Trạng ngữ) + Vị ngữ + (Tân ngữ).";
            }
        } else {
            // Remove the last <br><br>
            explanation = explanation.substring(0, explanation.length - 8);
        }
        
        return explanation;
    }

    document.getElementById('check-sentence-btn').addEventListener('click', checkSentence);
    document.getElementById('next-sentence-btn').addEventListener('click', nextSentence);
    
    // Press Enter to check
    translationInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            checkSentence();
        }
    });

    // === 6. LISTENING TAB ===
    let listeningScore = 0;
    let currentListeningQuestion = null;

    function initListening() {
        listeningScore = 0;
        document.getElementById('listening-score').innerText = listeningScore;
        nextListeningQuestion();
    }

    const imageListeningData = [
        {
            id: 'img1',
            sentence: "我有一只非常可爱的小黑猫，它喜欢吃鱼。",
            pinyin: "Wǒ yǒu yī zhī fēicháng kě'ài de xiǎo hēi māo, tā xǐhuān chī yú.",
            vi: "Tôi có một con mèo đen nhỏ rất đáng yêu, nó thích ăn cá.",
            options: [
                { id: 'img1', text: "🐈" },
                { id: 'wrong1_1', text: "🐕" },
                { id: 'wrong1_2', text: "🐇" },
                { id: 'wrong1_3', text: "🐦" }
            ]
        },
        {
            id: 'img2',
            sentence: "今天天气不太好，下午可能会下雨，你记得带伞。",
            pinyin: "Jīntiān tiānqì bù tài hǎo, xiàwǔ kěnéng huì xiàyǔ, nǐ jìde dài sǎn.",
            vi: "Hôm nay thời tiết không tốt lắm, buổi chiều có thể trời mưa, bạn nhớ mang ô nhé.",
            options: [
                { id: 'wrong2_1', text: "☀️" },
                { id: 'img2', text: "🌧️" },
                { id: 'wrong2_2', text: "❄️" },
                { id: 'wrong2_3', text: "🌪️" }
            ]
        },
        {
            id: 'img3',
            sentence: "妈妈去超市买了很多水果，有苹果、香蕉和西瓜。",
            pinyin: "Māma qù chāoshì mǎi le hěn duō shuǐguǒ, yǒu píngguǒ, xiāngjiāo hé xīguā.",
            vi: "Mẹ đi siêu thị mua rất nhiều trái cây, có táo, chuối và dưa hấu.",
            options: [
                { id: 'img3', text: "🍎" },
                { id: 'wrong3_1', text: "🍔" },
                { id: 'wrong3_2', text: "🍜" },
                { id: 'wrong3_3', text: "☕" }
            ]
        },
        {
            id: 'img4',
            sentence: "我爸爸是一名医生，他在一家很大的医院工作。",
            pinyin: "Wǒ bàba shì yī míng yīshēng, tā zài yī jiā hěn dà de yīyuàn gōngzuò.",
            vi: "Bố tôi là một bác sĩ, ông ấy làm việc ở một bệnh viện rất lớn.",
            options: [
                { id: 'wrong4_1', text: "👨‍🏫" },
                { id: 'img4', text: "👨‍⚕️" },
                { id: 'wrong4_2', text: "👮‍♂️" },
                { id: 'wrong4_3', text: "👨‍🍳" }
            ]
        },
        {
            id: 'img5',
            sentence: "哥哥买了一辆新车，是红色的，非常漂亮。",
            pinyin: "Gēge mǎi le yī liàng xīn chē, shì hóngsè de, fēicháng piàoliang.",
            vi: "Anh trai đã mua một chiếc ô tô mới, màu đỏ, vô cùng đẹp.",
            options: [
                { id: 'wrong5_1', text: "🚲" },
                { id: 'wrong5_2', text: "🚢" },
                { id: 'img5', text: "🚗" },
                { id: 'wrong5_3', text: "✈️" }
            ]
        },
        {
            id: 'img6',
            sentence: "他在商店买了一件漂亮的衣服，明天穿去学校。",
            pinyin: "Tā zài shāngdiàn mǎi le yī jiàn piàoliang de yīfu, míngtiān chuān qù xuéxiào.",
            vi: "Anh ấy đã mua một bộ quần áo đẹp ở cửa hàng, ngày mai sẽ mặc đến trường.",
            options: [
                { id: 'img6', text: "👗" },
                { id: 'wrong6_1', text: "👟" },
                { id: 'wrong6_2', text: "👜" },
                { id: 'wrong6_3', text: "👒" }
            ]
        },
        {
            id: 'img7',
            sentence: "他每天早上都喝一杯热茶。",
            pinyin: "Tā měitiān zǎoshang dōu hē yī bēi rè chá.",
            vi: "Mỗi buổi sáng anh ấy đều uống một cốc trà nóng.",
            options: [
                { id: 'wrong7_1', text: "🍺" },
                { id: 'wrong7_2', text: "🥛" },
                { id: 'wrong7_3', text: "🧃" },
                { id: 'img7', text: "🍵" }
            ]
        },
        {
            id: 'img8',
            sentence: "昨天晚上我看了一个很长很有意思的电影。",
            pinyin: "Zuótiān wǎnshang wǒ kàn le yī gè hěn cháng hěn yǒu yìsi de diànyǐng.",
            vi: "Tối hôm qua tôi đã xem một bộ phim rất dài và thú vị.",
            options: [
                { id: 'wrong8_1', text: "📖" },
                { id: 'img8', text: "🎬" },
                { id: 'wrong8_2', text: "🎮" },
                { id: 'wrong8_3', text: "🎵" }
            ]
        }
    ];

    let isCurrentImageQuestion = false;

    function nextListeningQuestion() {
        document.getElementById('next-listening-btn').classList.add('hidden');
        document.getElementById('listening-result-display').classList.add('hidden');
        
        // Randomly pick a vocabulary word or an image sentence (50% chance)
        isCurrentImageQuestion = Math.random() < 0.5;

        const optionsContainer = document.getElementById('listening-options');
        optionsContainer.innerHTML = '';
        
        if (isCurrentImageQuestion) {
            optionsContainer.classList.add('image-grid');
            const qIndex = Math.floor(Math.random() * imageListeningData.length);
            const qData = imageListeningData[qIndex];
            currentListeningQuestion = { id: qData.id, hanzi: qData.sentence }; // Mock structure for audio playing
            
            // Shuffle options
            const shuffledOptions = [...qData.options].sort(() => Math.random() - 0.5);
            
            shuffledOptions.forEach((opt, index) => {
                const btn = document.createElement('button');
                btn.className = 'option-btn image-option stagger-animate';
                btn.style.animationDelay = `${index * 0.1}s`;
                btn.style.fontSize = '3.5rem';
                btn.style.padding = '1rem';
                btn.style.display = 'flex';
                btn.style.justifyContent = 'center';
                btn.style.alignItems = 'center';
                btn.innerText = opt.text;
                btn.dataset.id = opt.id;
                btn.addEventListener('click', () => handleListeningAnswer(btn, opt.id, qData.id));
                optionsContainer.appendChild(btn);
            });
        } else {
            optionsContainer.classList.remove('image-grid');
            if (!currentVocabulary || currentVocabulary.length === 0) return;
            
            const qIndex = Math.floor(Math.random() * currentVocabulary.length);
            currentListeningQuestion = currentVocabulary[qIndex];
            
            // Generate options (Multiple Choice)
            const options = [currentListeningQuestion];
            while (options.length < 4) {
                const randomOption = currentVocabulary[Math.floor(Math.random() * currentVocabulary.length)];
                if (!options.find(opt => opt.id === randomOption.id)) {
                    options.push(randomOption);
                }
            }
            options.sort(() => Math.random() - 0.5);

            options.forEach((opt, index) => {
                const btn = document.createElement('button');
                btn.className = 'option-btn stagger-animate';
                btn.style.animationDelay = `${index * 0.1}s`;
                btn.innerText = `${opt.vi} (${opt.pinyin})`;
                btn.dataset.id = opt.id;
                btn.addEventListener('click', () => handleListeningAnswer(btn, opt.id, currentListeningQuestion.id));
                optionsContainer.appendChild(btn);
            });
        }

        // Auto play audio once
        setTimeout(() => speak(currentListeningQuestion.hanzi), 300);
    }

    function handleListeningAnswer(btn, selectedId, correctId) {
        const allBtns = document.querySelectorAll('#listening-options .option-btn');
        allBtns.forEach(b => b.style.pointerEvents = 'none');

        if (selectedId === correctId) {
            btn.classList.add('correct');
            listeningScore++;
            document.getElementById('listening-score').innerText = listeningScore;
        } else {
            btn.classList.add('wrong');
            allBtns.forEach(b => {
                if (b.dataset.id == currentListeningQuestion.id) {
                    b.classList.add('correct');
                }
            });
        }
        
        // Hiển thị kết quả đầy đủ
        const resultDisplay = document.getElementById('listening-result-display');
        resultDisplay.classList.remove('hidden');
        
        if (isCurrentImageQuestion) {
            const qData = imageListeningData.find(d => d.id === correctId);
            if (qData) {
                resultDisplay.innerHTML = `
                    <div style="font-size: 1.25rem; font-weight: 600; color: var(--primary-color); margin-bottom: 0.5rem;">${qData.sentence}</div>
                    <div style="color: var(--text-muted); margin-bottom: 0.5rem;">${qData.pinyin}</div>
                    <div style="font-weight: 500; color: var(--text-main);">${qData.vi}</div>
                `;
            }
        } else {
            resultDisplay.innerHTML = `
                <div style="font-size: 1.5rem; font-weight: 600; color: var(--primary-color); margin-bottom: 0.5rem;">${currentListeningQuestion.hanzi}</div>
                <div style="color: var(--text-muted); margin-bottom: 0.5rem;">${currentListeningQuestion.pinyin}</div>
                <div style="font-weight: 500; color: var(--text-main);">${currentListeningQuestion.vi}</div>
                ${currentListeningQuestion.example ? `<div style="margin-top: 0.5rem; font-size: 0.9rem; color: var(--text-muted); border-top: 1px dashed var(--border-color); padding-top: 0.5rem;">Ví dụ: ${currentListeningQuestion.example}</div>` : ''}
            `;
        }
        
        document.getElementById('next-listening-btn').classList.remove('hidden');
    }

    document.getElementById('listening-question').addEventListener('click', () => {
        if (currentListeningQuestion) {
            speak(currentListeningQuestion.hanzi);
        }
    });

    document.getElementById('next-listening-btn').addEventListener('click', nextListeningQuestion);

    // === 7. READING TAB ===
    let currentReadingIndex = 0;
    let isPinyinVisible = true;

    function initReading() {
        if (!currentReading || currentReading.length === 0) {
            document.getElementById('reading-content').innerText = "Chưa có dữ liệu bài đọc cho cấp độ này.";
            document.getElementById('reading-title').innerText = "";
            return;
        }
        
        // Shuffle the reading array so passages appear in random order
        currentReading = [...currentReading].sort(() => Math.random() - 0.5);
        currentReadingIndex = 0;
        
        loadReadingPassage();
    }

    function loadReadingPassage() {
        const passage = currentReading[currentReadingIndex];
        document.getElementById('reading-title').innerText = passage.title || "Bài Đọc";
        document.getElementById('reading-translation').innerText = passage.vietnamese;
        document.getElementById('reading-translation').classList.add('hidden');
        document.getElementById('toggle-translation-btn').innerText = "Xem bản dịch";
        document.getElementById('reading-speech-feedback').classList.add('hidden');
        
        renderReadingText(passage);
    }

    function renderReadingText(passage) {
        const contentDiv = document.getElementById('reading-content');
        contentDiv.innerHTML = '';
        
        // We render Chinese and Pinyin (if visible)
        // A simple way to show them is just rendering both, but realistically we would need them character by character.
        // For simplicity, we just display the Chinese text block, and the Pinyin text block below it.
        const hanziBlock = document.createElement('div');
        hanziBlock.innerText = passage.chinese;
        
        const pinyinBlock = document.createElement('div');
        pinyinBlock.innerText = passage.pinyin;
        pinyinBlock.style.fontSize = "1.2rem";
        pinyinBlock.style.color = "var(--primary-color)";
        pinyinBlock.style.marginTop = "1rem";
        if (!isPinyinVisible) {
            pinyinBlock.classList.add('hidden');
        }
        pinyinBlock.id = "reading-pinyin-block";
        
        contentDiv.appendChild(hanziBlock);
        contentDiv.appendChild(pinyinBlock);
    }

    document.getElementById('toggle-pinyin-btn').addEventListener('click', (e) => {
        isPinyinVisible = !isPinyinVisible;
        e.target.innerText = isPinyinVisible ? "Tắt Pinyin" : "Bật Pinyin";
        const pinyinBlock = document.getElementById('reading-pinyin-block');
        if (pinyinBlock) {
            if (isPinyinVisible) pinyinBlock.classList.remove('hidden');
            else pinyinBlock.classList.add('hidden');
        }
    });

    document.getElementById('toggle-translation-btn').addEventListener('click', (e) => {
        const transDiv = document.getElementById('reading-translation');
        if (transDiv.classList.contains('hidden')) {
            transDiv.classList.remove('hidden');
            e.target.innerText = "Ẩn bản dịch";
        } else {
            transDiv.classList.add('hidden');
            e.target.innerText = "Xem bản dịch";
        }
    });

    document.getElementById('listen-reading-btn').addEventListener('click', () => {
        if (currentReading && currentReading[currentReadingIndex]) {
            speak(currentReading[currentReadingIndex].chinese);
        }
    });

    document.getElementById('next-reading-btn').addEventListener('click', () => {
        // Stop ongoing audio when switching passage
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
        }
        
        if (currentReading && currentReading.length > 0) {
            currentReadingIndex = (currentReadingIndex + 1) % currentReading.length;
            loadReadingPassage();
        }
    });

    // --- Speech Recognition ---
    let recognition = null;
    let isRecording = false;
    let accumulatedTranscript = "";

    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognition = new SpeechRecognition();
        recognition.lang = 'zh-CN';
        recognition.continuous = true;
        recognition.interimResults = false;
        
        recognition.onresult = (event) => {
            let transcript = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
                transcript += event.results[i][0].transcript;
            }
            accumulatedTranscript += transcript;
            processSpeechResult(accumulatedTranscript);
        };
        
        recognition.onerror = (event) => {
            console.error('Speech recognition error', event.error);
            stopRecording();
            document.getElementById('speech-result-text').innerText = "Lỗi nhận diện: " + event.error;
            document.getElementById('speech-accuracy').innerText = "";
            document.getElementById('reading-speech-feedback').classList.remove('hidden');
        };
        
        recognition.onend = () => {
            // If it stops automatically due to pause but isRecording is true, we could restart it,
            // but standard behavior is to stop. Let's just update UI.
            if (isRecording) {
                stopRecording();
            }
        };
    }

    function startRecording() {
        if (!recognition) {
            alert('Trình duyệt của bạn không hỗ trợ nhận diện giọng nói. Vui lòng dùng Chrome hoặc Edge.');
            return;
        }
        isRecording = true;
        accumulatedTranscript = "";
        const btn = document.getElementById('record-reading-btn');
        btn.innerHTML = '<i class="ri-stop-circle-line"></i> Dừng thu âm';
        btn.style.background = 'var(--danger)';
        btn.style.color = 'white';
        
        document.getElementById('reading-speech-feedback').classList.add('hidden');
        document.getElementById('speech-result-text').innerText = "Đang nghe...";
        document.getElementById('reading-speech-feedback').classList.remove('hidden');
        
        try {
            recognition.start();
        } catch(e) {
            console.error(e);
        }
    }

    function stopRecording() {
        isRecording = false;
        const btn = document.getElementById('record-reading-btn');
        btn.innerHTML = '<i class="ri-mic-line"></i> Bắt đầu thu âm';
        btn.style.background = 'rgba(239, 68, 68, 0.1)';
        btn.style.color = 'var(--danger)';
        
        if (recognition) {
            try {
                recognition.stop();
            } catch(e) {}
        }
    }

    function processSpeechResult(transcript) {
        const feedbackDiv = document.getElementById('reading-speech-feedback');
        const resultText = document.getElementById('speech-result-text');
        const accuracyText = document.getElementById('speech-accuracy');
        
        feedbackDiv.classList.remove('hidden');
        resultText.innerText = transcript || "Không nghe rõ.";
        
        if (!transcript) return;
        
        // Normalize strings for comparison (remove punctuation and spaces)
        const normalize = (str) => {
            return str.replace(/[.,!?，。！？；：'"、\s]/g, '');
        };
        
        const originalText = currentReading[currentReadingIndex].chinese;
        const normOriginal = normalize(originalText);
        const normTranscript = normalize(transcript);
        
        if (normOriginal === normTranscript || normOriginal.includes(normTranscript) && normTranscript.length > 3) {
            accuracyText.innerText = "Tuyệt vời! Phát âm của bạn rất chuẩn.";
            accuracyText.style.color = "var(--success)";
        } else {
            accuracyText.innerText = "Chưa khớp hoàn toàn. Hãy cố gắng hơn nhé!";
            accuracyText.style.color = "var(--danger)";
        }
    }

    document.getElementById('record-reading-btn').addEventListener('click', () => {
        if (isRecording) {
            stopRecording();
        } else {
            startRecording();
        }
    });

    // === 7. AI CHAT TAB ===
    const aiKeyContainer = document.getElementById('ai-key-container');
    const aiChatInterface = document.getElementById('ai-chat-interface');
    const apiKeyInput = document.getElementById('gemini-api-key');
    const saveApiKeyBtn = document.getElementById('save-api-key-btn');
    const resetApiKeyBtn = document.getElementById('reset-api-key-btn');
    
    const chatInput = document.getElementById('chat-input');
    const sendChatBtn = document.getElementById('send-chat-btn');
    const attachImageBtn = document.getElementById('attach-image-btn');
    const chatFileInput = document.getElementById('chat-file-input');
    const chatImagePreview = document.getElementById('chat-image-preview');
    const previewImg = document.getElementById('preview-img');
    const removeImageBtn = document.getElementById('remove-image-btn');
    const chatMessages = document.getElementById('chat-messages');

    let currentBase64Image = null;
    let geminiApiKeys = [];
    let currentKeyIndex = 0;
    
    // Add new state variables
    let currentAiProvider = localStorage.getItem('hsk_ai_provider') || 'gemini';
    let currentAiModelId = localStorage.getItem('hsk_ai_model_id') || 'qwen/qwen3-next-80b-a3b-instruct:free';
    
    const aiProviderSelect = document.getElementById('ai-provider');
    const aiModelIdInput = document.getElementById('ai-model-id');
    const aiKeyLink = document.getElementById('ai-key-link');
    
    try {
        const stored = localStorage.getItem('hsk_gemini_api_key');
        if (stored) {
            geminiApiKeys = JSON.parse(stored);
            if (!Array.isArray(geminiApiKeys)) geminiApiKeys = [stored];
        }
    } catch {
        const stored = localStorage.getItem('hsk_gemini_api_key');
        if (stored) geminiApiKeys = [stored];
    }

    if (aiProviderSelect) {
        aiProviderSelect.value = currentAiProvider;
        aiModelIdInput.value = currentAiModelId;
        
        aiProviderSelect.addEventListener('change', (e) => {
            const provider = e.target.value;
            if (provider === 'openrouter') {
                aiModelIdInput.classList.remove('hidden');
                aiModelIdInput.value = "qwen/qwen3-next-80b-a3b-instruct:free";
                apiKeyInput.placeholder = "Nhập OpenRouter API Key (sk-or-v1-)...";
                aiKeyLink.href = "https://openrouter.ai/keys";
                aiKeyLink.innerText = "Nhấn vào đây để tạo OpenRouter API Key miễn phí";
            } else if (provider === 'alibabacloud') {
                aiModelIdInput.classList.remove('hidden');
                aiModelIdInput.value = "qwen-plus";
                apiKeyInput.placeholder = "Nhập Alibaba Cloud API Key (sk-)...";
                aiKeyLink.href = "https://dashscope.console.aliyun.com/apiKey";
                aiKeyLink.innerText = "Nhấn vào đây để tạo Alibaba Cloud API Key (DashScope)";
            } else {
                aiModelIdInput.classList.add('hidden');
                apiKeyInput.placeholder = "Nhập một hoặc nhiều API Key (cách nhau bằng dấu phẩy)...";
                aiKeyLink.href = "https://aistudio.google.com/app/apikey";
                aiKeyLink.innerText = "Nhấn vào đây để tạo Gemini API Key miễn phí";
            }
        });
        
        aiProviderSelect.dispatchEvent(new Event('change'));
    }

    // Init UI based on API key presence
    if (geminiApiKeys.length > 0) {
        aiKeyContainer.classList.add('hidden');
        aiChatInterface.classList.remove('hidden');
    }

    saveApiKeyBtn.addEventListener('click', () => {
        const provider = document.getElementById('ai-provider').value;
        const modelId = document.getElementById('ai-model-id').value.trim();
        const inputVal = apiKeyInput.value.trim();
        
        let keys = [];
        if (provider === 'gemini') {
            keys = inputVal.split(',').map(k => k.trim()).filter(k => k.startsWith('AIzaSy') && k.length > 30);
        } else if (provider === 'openrouter') {
            keys = inputVal.split(',').map(k => k.trim()).filter(k => k.startsWith('sk-or-v1-') && k.length > 30);
        } else if (provider === 'alibabacloud') {
            keys = inputVal.split(',').map(k => k.trim()).filter(k => k.startsWith('sk-') && k.length > 20);
        }
        
        if (keys.length > 0) {
            localStorage.setItem('hsk_gemini_api_key', JSON.stringify(keys));
            localStorage.setItem('hsk_ai_provider', provider);
            localStorage.setItem('hsk_ai_model_id', modelId);
            
            geminiApiKeys = keys;
            currentAiProvider = provider;
            currentAiModelId = modelId;
            currentKeyIndex = 0;
            
            apiKeyInput.value = '';
            aiKeyContainer.classList.add('hidden');
            aiChatInterface.classList.remove('hidden');
        } else {
            if (provider === 'gemini') alert('API Key không hợp lệ. Khóa API của Gemini thường bắt đầu bằng AIzaSy...');
            else if (provider === 'openrouter') alert('API Key không hợp lệ. Khóa API của OpenRouter thường bắt đầu bằng sk-or-v1-...');
            else alert('API Key không hợp lệ. Khóa API của Alibaba Cloud thường bắt đầu bằng sk-...');
        }
    });

    resetApiKeyBtn.addEventListener('click', () => {
        if (confirm('Bạn muốn đổi API Key khác? Lịch sử chat hiện tại sẽ bị xóa.')) {
            localStorage.removeItem('hsk_gemini_api_key');
            geminiApiKeys = [];
            currentKeyIndex = 0;
            chatMessages.innerHTML = `
                <div class="chat-message ai">
                    <div class="chat-avatar"><i class="ri-robot-2-fill"></i></div>
                    <div class="chat-bubble">Chào bạn! Hãy tải lên một bức ảnh và nói điều gì đó, chúng ta sẽ luyện tập tiếng Trung cùng nhau nhé! 😊</div>
                </div>
            `;
            aiChatInterface.classList.add('hidden');
            aiKeyContainer.classList.remove('hidden');
        }
    });

    // Handle Image Upload
    attachImageBtn.addEventListener('click', () => {
        chatFileInput.click();
    });

    chatFileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                currentBase64Image = event.target.result;
                previewImg.src = currentBase64Image;
                chatImagePreview.classList.remove('hidden');
            };
            reader.readAsDataURL(file);
        }
    });

    removeImageBtn.addEventListener('click', () => {
        currentBase64Image = null;
        chatFileInput.value = '';
        chatImagePreview.classList.add('hidden');
    });

    // Auto resize textarea
    chatInput.addEventListener('input', function() {
        this.style.height = '48px';
        this.style.height = (this.scrollHeight) + 'px';
    });

    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendChatBtn.click();
        }
    });

    function cleanForSpeech(text) {
        // Remove text in parentheses (Pinyin)
        let cleaned = text.replace(/\([^)]*\)/g, '').replace(/（[^）]*）/g, '');
        // Remove Vietnamese translation (everything after a dash on each line)
        cleaned = cleaned.replace(/\s*[-—]\s*.*/g, '');
        return cleaned.trim();
    }

    function appendMessage(role, text, imageBase64 = null) {
        const msgDiv = document.createElement('div');
        msgDiv.className = `chat-message ${role}`;
        
        let avatarIcon = role === 'ai' ? '<i class="ri-robot-2-fill"></i>' : '<i class="ri-user-smile-line"></i>';
        
        let bubbleContentHtml = ``;
        let formattedText = text.replace(/\n/g, '<br>');
        formattedText = formattedText.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>'); // Bold
        formattedText = formattedText.replace(/\*(.*?)\*/g, '<i>$1</i>'); // Italic

        bubbleContentHtml += formattedText;
        
        if (imageBase64) {
            bubbleContentHtml += `<img src="${imageBase64}" alt="User Image">`;
        }
        
        let contentHtml = `<div class="chat-avatar">${avatarIcon}</div>
                           <div style="display: flex; flex-direction: column;">
                               <div class="chat-bubble">${bubbleContentHtml}</div>`;
        
        if (role === 'ai') {
            contentHtml += `<div class="chat-bubble-actions">
                                <button class="chat-audio-btn" title="Nghe lại"><i class="ri-volume-up-fill"></i></button>
                            </div>`;
        }
        
        contentHtml += `</div>`;
        msgDiv.innerHTML = contentHtml;
        
        if (role === 'ai') {
            const btn = msgDiv.querySelector('.chat-audio-btn');
            btn.addEventListener('click', () => {
                speak(cleanForSpeech(text));
            });
        }

        chatMessages.appendChild(msgDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        return msgDiv;
    }

    function showTypingIndicator() {
        const msgDiv = document.createElement('div');
        msgDiv.className = `chat-message ai typing-indicator-msg`;
        msgDiv.innerHTML = `
            <div class="chat-avatar"><i class="ri-robot-2-fill"></i></div>
            <div class="chat-bubble typing-indicator">
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
            </div>
        `;
        chatMessages.appendChild(msgDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        return msgDiv;
    }

    // --- AI Chat Speech Recognition ---
    const recordChatBtn = document.getElementById('record-chat-btn');
    let aiChatRecognition = null;
    let aiChatIsRecording = false;

    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        aiChatRecognition = new SpeechRecognition();
        aiChatRecognition.lang = 'zh-CN';
        aiChatRecognition.continuous = false;
        aiChatRecognition.interimResults = false;
        
        aiChatRecognition.onstart = () => {
            aiChatIsRecording = true;
            recordChatBtn.classList.add('recording');
            chatInput.placeholder = "Đang nghe... Hãy nói tiếng Trung!";
        };
        
        aiChatRecognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            chatInput.value = transcript;
        };
        
        aiChatRecognition.onerror = (event) => {
            console.error("Speech recognition error", event.error);
            chatInput.placeholder = "Lỗi thu âm. Nhấn Micro để thử lại.";
        };
        
        aiChatRecognition.onend = () => {
            aiChatIsRecording = false;
            recordChatBtn.classList.remove('recording');
            chatInput.placeholder = "Nhấn nút Micro để nói...";
            
            // Auto send if there's text
            if (chatInput.value.trim().length > 0) {
                sendChatBtn.click();
            }
        };
    }

    if(recordChatBtn) {
        recordChatBtn.addEventListener('click', () => {
            if (!aiChatRecognition) {
                alert('Trình duyệt không hỗ trợ nhận diện giọng nói. Bạn có thể gõ chữ.');
                return;
            }
            if (aiChatIsRecording) {
                aiChatRecognition.stop();
            } else {
                chatInput.value = '';
                try {
                    aiChatRecognition.start();
                } catch(e) {}
            }
        });
    }

    async function generateAIResponse(userText, imageBase64) {
        if (!geminiApiKeys || geminiApiKeys.length === 0) return;
        
        const hskLevel = document.getElementById('hsk-level-selector').value;
        const systemInstruction = `Bạn là một gia sư tiếng Trung thân thiện và nhiệt tình. Bạn đang giúp học viên luyện tập tiếng Trung thông qua hình ảnh. Trình độ hiện tại của học viên là HSK ${hskLevel}. Nhiệm vụ của bạn: 1. Thảo luận về bức ảnh học viên gửi bằng tiếng Trung. 2. Đặt các câu hỏi đơn giản để khuyến khích học viên trả lời. 3. TUYỆT ĐỐI GIỚI HẠN từ vựng và ngữ pháp ở mức HSK ${hskLevel}. Không dùng từ vựng khó, nếu bắt buộc phải dùng để mô tả bức ảnh thì hãy giải thích nghĩa của nó. 4. Luôn cung cấp Pinyin cho các chữ Hán bạn dùng. Định dạng: Chữ Hán (Pinyin) - Nghĩa tiếng Việt. 5. Phản hồi ngắn gọn, tự nhiên như giao tiếp hàng ngày.`;

        let url, requestOptions;
        
        if (currentAiProvider === 'openrouter' || currentAiProvider === 'alibabacloud') {
            let modelId = currentAiModelId;
            let messagesContent = [];
            
            if (imageBase64) {
                // Auto switch to a vision model if image is uploaded
                if (currentAiProvider === 'openrouter') {
                    modelId = 'google/gemini-2.0-pro-exp-02-05:free';
                } else {
                    modelId = 'qwen-vl-plus';
                }
                
                if (userText) messagesContent.push({ type: "text", text: userText });
                messagesContent.push({
                    type: "image_url",
                    image_url: { url: imageBase64 }
                });
            } else {
                if (currentAiProvider === 'alibabacloud') {
                    messagesContent = userText || "Vui lòng mô tả bức ảnh này bằng tiếng Trung."; // Alibaba text models prefer string
                } else {
                    if (userText) messagesContent.push({ type: "text", text: userText });
                }
            }
            
            const requestBody = {
                model: modelId,
                messages: [
                    { role: "system", content: systemInstruction },
                    { role: "user", content: messagesContent }
                ],
                temperature: 0.7,
                max_tokens: 800
            };
            
            if (currentAiProvider === 'openrouter') {
                url = 'https://openrouter.ai/api/v1/chat/completions';
            } else {
                url = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';
            }
            
            requestOptions = {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'HTTP-Referer': window.location.href,
                    'X-Title': 'HSK Master'
                },
                body: JSON.stringify(requestBody)
            };
        } else {
            // Gemini Format
            let contents = [];
            let parts = [{ text: userText }];
            
            if (imageBase64) {
                const base64Data = imageBase64.split(',')[1];
                const mimeType = imageBase64.split(';')[0].split(':')[1];
                parts.push({
                    inline_data: {
                        mime_type: mimeType,
                        data: base64Data
                    }
                });
            }
            
            contents.push({ parts: parts });

            const requestBody = {
                system_instruction: { parts: [{ text: systemInstruction }] },
                contents: contents,
                generationConfig: { temperature: 0.7, maxOutputTokens: 800 }
            };
            
            requestOptions = {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            };
        }

        let retries = 3;
        while (retries > 0) {
            let currentApiKey = geminiApiKeys[currentKeyIndex];
            if (!currentApiKey) return `Lỗi: Không tìm thấy API Key hợp lệ.`;
            
            if (currentAiProvider === 'openrouter' || currentAiProvider === 'alibabacloud') {
                requestOptions.headers['Authorization'] = `Bearer ${currentApiKey}`;
            } else {
                url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${currentApiKey}`;
            }
            
            try {
                const response = await fetch(url, requestOptions);

                if (response.status === 429) {
                    if (currentKeyIndex < geminiApiKeys.length - 1) {
                        currentKeyIndex++; // Switch to next key
                        continue;
                    }
                    return `Lỗi 429: Tất cả API Key của bạn đã hết lượt sử dụng miễn phí. Bạn vui lòng tạo và cung cấp thêm API Key mới nhé!`;
                }

                if (response.status === 503 || response.status === 500) {
                    if (retries > 1) {
                        await new Promise(r => setTimeout(r, 4000));
                        retries--;
                        continue;
                    }
                    return `Hệ thống AI hiện đang bị quá tải (Lỗi ${response.status}). Hệ thống đã tự động thử lại nhưng chưa được. Bạn vui lòng đợi 1-2 phút rồi thử lại nhé!`;
                }

                const data = await response.json();
                
                if (data.error) {
                    const errorMsg = data.error.message || 'Unknown error';
                    const errorCode = data.error.code || '';
                    if (errorMsg.includes('API key not valid') || errorCode === 'invalid_api_key' || response.status === 403 || response.status === 401) {
                        if (currentKeyIndex < geminiApiKeys.length - 1) {
                            currentKeyIndex++; // Switch to next key
                            continue;
                        }
                        return `Lỗi: Tất cả API Key bạn nhập đều không hợp lệ hoặc đã bị vô hiệu hóa. Vui lòng kiểm tra lại!`;
                    }

                    if ((response.status === 503 || response.status === 429 || errorMsg.includes('high demand') || errorMsg.includes('rate limit')) && retries > 1) {
                        await new Promise(r => setTimeout(r, 4000));
                        retries--;
                        continue;
                    }
                    throw new Error(errorMsg);
                }
                
                if (currentAiProvider === 'openrouter' || currentAiProvider === 'alibabacloud') {
                    if (data.choices && data.choices.length > 0) {
                        return data.choices[0].message.content;
                    }
                    throw new Error('Invalid response format from ' + currentAiProvider);
                } else {
                    if (data.candidates && data.candidates.length > 0) {
                        return data.candidates[0].content.parts[0].text;
                    }
                    throw new Error('Invalid Gemini response format');
                }
                
            } catch (error) {
                console.error('AI API Error:', error);
                
                if (error.message.includes('API key not valid') || error.message.includes('auth')) {
                    if (currentKeyIndex < geminiApiKeys.length - 1) {
                        currentKeyIndex++; // Switch to next key
                        continue;
                    }
                    return `Lỗi: Tất cả API Key bạn nhập đều không hợp lệ. Vui lòng kiểm tra lại!`;
                }
                
                if (retries > 1 && (error.message.includes('high demand') || error.message.includes('503') || error.message.includes('429') || error.message.includes('rate limit'))) {
                    await new Promise(r => setTimeout(r, 4000));
                    retries--;
                    continue;
                }
                
                if (error.message.includes('high demand') || error.message.includes('503') || error.message.includes('Failed to fetch')) {
                    return `Hệ thống AI hiện đang bị quá tải hoặc mạng chập chờn. Bạn vui lòng đợi một chút và thử lại nhé!`;
                }
                return `Xin lỗi, đã có lỗi xảy ra khi gọi API: ${error.message}`;
            }
        }
    }

    sendChatBtn.addEventListener('click', async () => {
        const text = chatInput.value.trim();
        if (!text && !currentBase64Image) return;

        const imageToSend = currentBase64Image;
        
        appendMessage('user', text, imageToSend);
        
        chatInput.value = '';
        chatInput.style.height = '48px';
        removeImageBtn.click();
        
        const typingIndicator = showTypingIndicator();
        sendChatBtn.disabled = true;
        chatInput.disabled = true;
        attachImageBtn.disabled = true;
        if(recordChatBtn) recordChatBtn.disabled = true;
        
        const aiResponseText = await generateAIResponse(text || "Vui lòng mô tả bức ảnh này bằng tiếng Trung.", imageToSend);
        
        typingIndicator.remove();
        sendChatBtn.disabled = false;
        chatInput.disabled = false;
        attachImageBtn.disabled = false;
        if(recordChatBtn) recordChatBtn.disabled = false;
        chatInput.focus();
        
        appendMessage('ai', aiResponseText);
        
        // Auto read the response out loud
        speak(cleanForSpeech(aiResponseText));
    });
    // === 8. MOCK EXAM TAB ===
    let currentMockExam = null;
    let mockExamQuestions = [];
    let currentMockQuestionIndex = 0;
    let mockExamTimer;
    let mockExamTimeLeft = 0;

    // Make this globally accessible inside the DOMContentLoaded scope so it can be called from the levelSelector change
    window.initMockExamList = function() {
        const levelSelectorNode = document.getElementById('hsk-level-selector');
        if (!levelSelectorNode) return;
        const level = levelSelectorNode.value;
        const listContainer = document.getElementById('mock-exam-list');
        const desc = document.getElementById('mock-exam-level-desc');
        
        document.getElementById('mock-exam-intro').classList.remove('hidden');
        document.getElementById('mock-exam-active').classList.add('hidden');
        document.getElementById('mock-exam-result').classList.add('hidden');
        
        if (typeof mockExamsData === 'undefined' || !mockExamsData[level] || mockExamsData[level].length === 0) {
            desc.innerText = `Hệ thống chưa có đề thi thử cho HSK ${level}.`;
            listContainer.innerHTML = '';
            return;
        }
        
        const exams = mockExamsData[level];
        desc.innerText = `Hệ thống hiện có ${exams.length} đề thi thử cho HSK ${level}.`;
        listContainer.innerHTML = '';
        
        exams.forEach((exam, index) => {
            const card = document.createElement('div');
            card.className = 'stagger-animate';
            card.style.animationDelay = `${index * 0.1}s`;
            card.style.background = 'var(--surface-color)';
            card.style.border = '2px solid var(--border-color)';
            card.style.borderRadius = '16px';
            card.style.padding = '1.5rem';
            card.style.boxShadow = '0 4px 0 var(--border-color)';
            card.innerHTML = `
                <h4 style="color: var(--text-main); margin-bottom: 0.5rem; font-size: 1.1rem;">${exam.title}</h4>
                <p style="color: var(--text-muted); font-size: 0.9rem; margin-bottom: 1rem;"><i class="ri-time-line"></i> ${exam.duration / 60} phút &bull; ${exam.questions.length} câu</p>
                <button class="btn primary-btn" style="width: 100%; box-shadow: 0 4px 0 var(--primary-shadow);">Bắt đầu thi</button>
            `;
            
            card.querySelector('button').addEventListener('click', () => startMockExam(exam.id, level));
            listContainer.appendChild(card);
        });
    };

    function startMockExam(examId, level) {
        currentMockExam = mockExamsData[level].find(e => e.id === examId);
        if (!currentMockExam) return;
        
        document.getElementById('mock-exam-intro').classList.add('hidden');
        document.getElementById('mock-exam-result').classList.add('hidden');
        document.getElementById('mock-exam-active').classList.remove('hidden');
        
        document.getElementById('mock-exam-active-title').innerText = currentMockExam.title;
        
        mockExamQuestions = JSON.parse(JSON.stringify(currentMockExam.questions)); // Deep copy
        currentMockQuestionIndex = 0;
        
        mockExamTimeLeft = currentMockExam.duration;
        updateMockTimerDisplay();
        
        clearInterval(mockExamTimer);
        mockExamTimer = setInterval(() => {
            mockExamTimeLeft--;
            updateMockTimerDisplay();
            if (mockExamTimeLeft <= 0) {
                clearInterval(mockExamTimer);
                finishMockExam(true);
            }
        }, 1000);
        
        showMockQuestion();
    }

    function updateMockTimerDisplay() {
        const mins = Math.floor(mockExamTimeLeft / 60).toString().padStart(2, '0');
        const secs = (mockExamTimeLeft % 60).toString().padStart(2, '0');
        document.getElementById('mock-exam-time-left').innerText = `${mins}:${secs}`;
    }

    function showMockQuestion() {
        const q = mockExamQuestions[currentMockQuestionIndex];
        document.getElementById('mock-exam-section-name').innerText = `Câu ${currentMockQuestionIndex + 1} / ${mockExamQuestions.length}: ${q.section}`;
        
        const qText = document.getElementById('mock-exam-question-text');
        const audioContainer = document.getElementById('mock-exam-audio-container');
        const optionsContainer = document.getElementById('mock-exam-options');
        
        qText.innerText = q.text || '';
        if (q.type === 'reading') {
            qText.innerHTML = q.text;
        } else if (q.type === 'writing') {
            qText.innerHTML = `<span style="color:var(--text-muted); font-size:1rem; font-weight:400; display:block; margin-bottom:0.5rem;">${q.section}</span>${q.text}`;
        }
        
        optionsContainer.innerHTML = '';
        
        if (q.type === 'listening') {
            audioContainer.classList.remove('hidden');
            q.playCount = q.playCount || 0;
            const playBtn = document.getElementById('mock-exam-play-audio-btn');
            
            const handlePlay = () => {
                if (q.playCount < 2) {
                    speak(q.audioText);
                    q.playCount++;
                    if (q.playCount >= 2) {
                        playBtn.style.opacity = '0.5';
                        playBtn.style.pointerEvents = 'none';
                    }
                }
            };
            
            playBtn.onclick = handlePlay;
            
            if (q.playCount >= 2) {
                playBtn.style.opacity = '0.5';
                playBtn.style.pointerEvents = 'none';
            } else {
                playBtn.style.opacity = '1';
                playBtn.style.pointerEvents = 'auto';
                if (q.playCount === 0) {
                    handlePlay(); // Auto play the first time viewing the question
                }
            }
        } else {
            audioContainer.classList.add('hidden');
        }
        
        if (q.type === 'writing') {
            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'translation-input';
            input.placeholder = 'Nhập câu trả lời...';
            input.value = q.userAnswer || '';
            input.oninput = (e) => {
                q.userAnswer = e.target.value;
                renderMockPalette();
            };
            optionsContainer.appendChild(input);
            setTimeout(() => input.focus(), 50);
        } else {
            q.options.forEach((opt, index) => {
                const btn = document.createElement('button');
                btn.className = 'option-btn stagger-animate';
                btn.style.animationDelay = `${index * 0.1}s`;
                btn.style.textAlign = 'left';
                btn.innerText = String.fromCharCode(65 + index) + '. ' + opt;
                if (q.userAnswer === index) {
                    btn.style.borderColor = 'var(--primary-color)';
                    btn.style.background = 'rgba(59, 130, 246, 0.1)';
                }
                btn.onclick = () => {
                    q.userAnswer = index;
                    showMockQuestion();
                    renderMockPalette();
                };
                optionsContainer.appendChild(btn);
            });
        }
        
        renderMockPalette();
    }

    function renderMockPalette() {
        const palette = document.getElementById('mock-exam-palette');
        if (!palette) return;
        palette.innerHTML = '';
        mockExamQuestions.forEach((q, index) => {
            const btn = document.createElement('button');
            btn.className = 'palette-btn';
            btn.style.padding = '8px 4px';
            btn.style.borderRadius = '8px';
            btn.style.border = '1px solid var(--border-color)';
            btn.style.background = (q.userAnswer !== undefined && q.userAnswer !== '') ? 'var(--primary-color)' : 'var(--surface-color)';
            btn.style.color = (q.userAnswer !== undefined && q.userAnswer !== '') ? 'white' : 'var(--text-main)';
            btn.style.fontWeight = '600';
            btn.style.cursor = 'pointer';
            btn.innerText = index + 1;
            
            if (index === currentMockQuestionIndex) {
                btn.style.border = '2px solid var(--danger)';
                btn.style.transform = 'scale(1.1)';
            }
            
            btn.onclick = () => {
                currentMockQuestionIndex = index;
                showMockQuestion();
            };
            palette.appendChild(btn);
        });
    }

    document.getElementById('mock-exam-prev-btn')?.addEventListener('click', () => {
        if (currentMockQuestionIndex > 0) {
            currentMockQuestionIndex--;
            showMockQuestion();
        }
    });

    document.getElementById('mock-exam-next-btn')?.addEventListener('click', () => {
        if (currentMockQuestionIndex < mockExamQuestions.length - 1) {
            currentMockQuestionIndex++;
            showMockQuestion();
        }
    });

    document.getElementById('mock-exam-submit-early-btn')?.addEventListener('click', () => {
        if (confirm("Bạn có chắc muốn nộp bài sớm?")) {
            finishMockExam(false);
        }
    });

    document.getElementById('mock-exam-back-btn')?.addEventListener('click', () => {
        window.initMockExamList();
    });

    function finishMockExam(isTimeout) {
        clearInterval(mockExamTimer);
        document.getElementById('mock-exam-active').classList.add('hidden');
        document.getElementById('mock-exam-result').classList.remove('hidden');
        
        let correctCount = 0;
        const normalize = (str) => str.replace(/[.,!?，。！？；：'"、\s]/g, '').toLowerCase();
        
        mockExamQuestions.forEach(q => {
            if (q.type === 'writing') {
                if (q.userAnswer && normalize(q.userAnswer) === normalize(q.options[q.answer])) {
                    correctCount++;
                }
            } else {
                if (q.userAnswer === q.answer) {
                    correctCount++;
                }
            }
        });
        
        const levelSelectorNode = document.getElementById('hsk-level-selector');
        const level = levelSelectorNode ? levelSelectorNode.value : '1';
        const maxScore = level === '3' ? 300 : 200;
        const passingScore = level === '3' ? 180 : 120;
        
        // Tính điểm mô phỏng dựa trên phần trăm đúng
        const finalScore = Math.round((correctCount / mockExamQuestions.length) * maxScore);
        
        document.getElementById('mock-exam-final-score').innerText = `${finalScore}/${maxScore}`;
        const statusMsg = document.getElementById('mock-exam-status-msg');
        
        if (finalScore >= passingScore) {
            statusMsg.innerText = isTimeout ? "Hết giờ! Chúc mừng bạn ĐÃ ĐỖ! 🎉" : "Chúc mừng bạn ĐÃ ĐỖ! 🎉";
            statusMsg.style.color = 'var(--success)';
            shootConfetti();
        } else {
            statusMsg.innerText = isTimeout ? "Hết giờ! Bạn chưa đạt điểm đỗ. 😥" : "Bạn chưa đạt điểm đỗ. 😥";
            statusMsg.style.color = 'var(--danger)';
        }

        renderMockExamDetails();
    }

    function renderMockExamDetails() {
        const detailsContainer = document.getElementById('mock-exam-detailed-results');
        const filterWrong = document.getElementById('mock-exam-filter-wrong').checked;
        detailsContainer.innerHTML = '';
        
        const normalize = (str) => str.replace(/[.,!?，。！？；：'"、\s]/g, '').toLowerCase();

        mockExamQuestions.forEach((q, index) => {
            let isCorrect = false;
            let userAnswerStr = "Chưa trả lời";
            let correctAnswerStr = "";
            
            if (q.type === 'writing') {
                correctAnswerStr = q.options[q.answer];
                if (q.userAnswer) {
                    userAnswerStr = q.userAnswer;
                    if (normalize(q.userAnswer) === normalize(correctAnswerStr)) {
                        isCorrect = true;
                    }
                }
            } else {
                correctAnswerStr = q.options[q.answer];
                if (q.userAnswer !== undefined && q.userAnswer !== '') {
                    userAnswerStr = q.options[q.userAnswer];
                    if (q.userAnswer === q.answer) {
                        isCorrect = true;
                    }
                }
            }
            
            if (filterWrong && isCorrect) return;
            
            const card = document.createElement('div');
            card.style.background = 'var(--surface-color)';
            card.style.padding = '1.5rem';
            card.style.borderRadius = '12px';
            card.style.border = `2px solid ${isCorrect ? 'var(--success-shadow)' : 'var(--danger-shadow)'}`;
            
            let qTextHtml = q.text || '';
            if (q.type === 'listening') {
                qTextHtml = `[${q.section}] ${qTextHtml} <br><span style="color:var(--text-muted); font-size: 0.9rem;">(Audio: ${q.audioText} - ${q.pinyin})</span>`;
            } else {
                qTextHtml = `[${q.section}] ${qTextHtml}`;
            }

            card.innerHTML = `
                <div style="display: flex; justify-content: space-between; margin-bottom: 1rem;">
                    <strong style="color: ${isCorrect ? 'var(--success)' : 'var(--danger)'};">Câu ${index + 1}: ${isCorrect ? 'Đúng' : 'Sai'}</strong>
                </div>
                <div style="margin-bottom: 1rem; color: var(--text-main); font-size: 1.1rem; line-height: 1.5;">${qTextHtml}</div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; font-size: 0.95rem;">
                    <div style="background: rgba(239, 68, 68, 0.05); padding: 1rem; border-radius: 8px;">
                        <div style="color: var(--text-muted); margin-bottom: 0.25rem;">Bạn chọn/nhập:</div>
                        <div style="color: ${isCorrect ? 'var(--success)' : 'var(--danger)'}; font-weight: 600;">${userAnswerStr}</div>
                    </div>
                    <div style="background: rgba(34, 197, 94, 0.05); padding: 1rem; border-radius: 8px;">
                        <div style="color: var(--text-muted); margin-bottom: 0.25rem;">Đáp án đúng:</div>
                        <div style="color: var(--success); font-weight: 600;">${correctAnswerStr}</div>
                    </div>
                </div>
            `;
            detailsContainer.appendChild(card);
        });
    }

    document.getElementById('mock-exam-filter-wrong')?.addEventListener('change', renderMockExamDetails);

    // Magic Glow Cursor Logic
    const glowCursor = document.getElementById('glow-cursor');
    if (glowCursor) {
        document.addEventListener('mousemove', (e) => {
            glowCursor.style.left = e.clientX + 'px';
            glowCursor.style.top = e.clientY + 'px';
        });
    }

    // Confetti Effect Function
    window.shootConfetti = function() {
        for (let i = 0; i < 150; i++) {
            const confetti = document.createElement('div');
            confetti.style.position = 'fixed';
            confetti.style.left = '50%';
            confetti.style.top = '50%';
            confetti.style.width = Math.random() * 10 + 5 + 'px';
            confetti.style.height = Math.random() * 10 + 5 + 'px';
            confetti.style.background = `hsl(${Math.random() * 360}, 100%, 50%)`;
            confetti.style.borderRadius = Math.random() > 0.5 ? '50%' : '0';
            confetti.style.pointerEvents = 'none';
            confetti.style.zIndex = '10000';
            
            const tx = (Math.random() - 0.5) * window.innerWidth;
            const ty = (Math.random() - 0.5) * window.innerHeight - 200;
            const rot = Math.random() * 360;
            
            confetti.animate([
                { transform: `translate(-50%, -50%) rotate(0deg)`, opacity: 1 },
                { transform: `translate(calc(-50% + ${tx}px), calc(-50% + ${ty}px)) rotate(${rot}deg)`, opacity: 0 }
            ], {
                duration: Math.random() * 1000 + 1500,
                easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                fill: 'forwards'
            });
            
            document.body.appendChild(confetti);
            setTimeout(() => confetti.remove(), 2500);
        }
    };

});
