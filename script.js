class BaccaratGame {
    constructor() {
        this.balance = 1000;
        this.selectedChip = 10;
        this.bets = {
            banker: 0,
            player: 0,
            tie: 0,
            bankerBonus: 0,
            bankerSuper: 0
        };
        this.lastBets = {
            banker: 0,
            player: 0,
            tie: 0,
            bankerBonus: 0,
            bankerSuper: 0
        };
        this.bankerBonusBase = 0; // 加收下注的基本金額
        this.lastBankerBonusBase = 0; // 上次加收下注的基本金額
        this.bankerSuperBase = 0; // 超級加押的基本金額
        this.lastBankerSuperBase = 0; // 上次超級加押的基本金額
        this.gameHistory = [];
        this.currentCards = {
            banker: [],
            player: []
        };
        this.gameState = 'betting'; // 'betting', 'dealing', 'finished'
        this.bonusMultiplier = null; // 當前加收賠率
        this.superMultiplier = null; // 當前超級加押賠率
        
        // 牌組系統 - 6副牌 (312張牌)
        this.deckCount = 6; // 使用6副牌
        this.shoe = []; // 鞋牌
        this.minCardsBeforeShuffle = 60; // 剩餘60張牌以下時重新洗牌
        this.initializeShoe();
        
        // 加收賠率表
        this.bonusPayoutTable = [
            { multiplier: 2.0, weight: 150 },
            { multiplier: 2.5, weight: 3 },
            { multiplier: 3.0, weight: 1 }
        ];
        
        // 超級加押賠率表
        this.superPayoutTable = [
            { multiplier: 9.0, weight: 100 },
            { multiplier: 11.0, weight: 10 },
            { multiplier: 13.0, weight: 5 },
            { multiplier: 14.0, weight: 3 },
            { multiplier: 19.0, weight: 1 }
        ];
        
        this.initializeEventListeners();
        this.updateUI();
    }

    // 初始化鞋牌（6副牌）
    initializeShoe() {
        this.shoe = [];
        const suits = ['♠', '♥', '♦', '♣'];
        const values = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
        
        // 創建6副牌
        for (let deck = 0; deck < this.deckCount; deck++) {
            for (const suit of suits) {
                for (const value of values) {
                    this.shoe.push({ suit, value });
                }
            }
        }
        
        // 洗牌
        this.shuffleShoe();
    }

    // 洗牌算法（Fisher-Yates shuffle）
    shuffleShoe() {
        for (let i = this.shoe.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.shoe[i], this.shoe[j]] = [this.shoe[j], this.shoe[i]];
        }
        
        // 顯示洗牌信息
        console.log(`牌組已洗牌，共 ${this.shoe.length} 張牌`);
    }

    // 檢查是否需要重新洗牌
    checkAndReshuffleIfNeeded() {
        if (this.shoe.length <= this.minCardsBeforeShuffle) {
            console.log(`剩餘牌數過少 (${this.shoe.length})，重新洗牌...`);
            this.initializeShoe();
            
            // 可以在這裡添加UI提示
            if (document.getElementById('shuffle-indicator')) {
                const indicator = document.getElementById('shuffle-indicator');
                indicator.style.display = 'block';
                setTimeout(() => {
                    indicator.style.display = 'none';
                }, 2000);
            }
        }
    }

    initializeEventListeners() {
        // 籌碼選擇
        document.querySelectorAll('.chip').forEach(chip => {
            chip.addEventListener('click', (e) => {
                this.selectChip(parseInt(e.target.dataset.value));
            });
        });

        // 下注區域點擊
        document.getElementById('bet-banker').addEventListener('click', () => {
            this.placeBet('banker');
        });
        document.getElementById('bet-player').addEventListener('click', () => {
            this.placeBet('player');
        });
        document.getElementById('bet-tie').addEventListener('click', () => {
            this.placeBet('tie');
        });
        document.getElementById('bet-banker-bonus').addEventListener('click', () => {
            this.placeBet('bankerBonus');
        });
        document.getElementById('bet-banker-super').addEventListener('click', () => {
            this.placeBet('bankerSuper');
        });

        // 控制按鈕
        document.getElementById('deal-btn').addEventListener('click', () => {
            this.dealCards();
        });
        document.getElementById('clear-bets-btn').addEventListener('click', () => {
            this.clearBets();
        });
        document.getElementById('new-game-btn').addEventListener('click', () => {
            this.newGame();
        });
        document.getElementById('continue-btn').addEventListener('click', () => {
            this.continueGame();
        });
        
        // 重複下注按鈕
        document.getElementById('repeat-bet-btn').addEventListener('click', () => {
            this.repeatLastBet();
        });
    }

    selectChip(value) {
        this.selectedChip = value;
        
        // 更新UI
        document.querySelectorAll('.chip').forEach(chip => {
            chip.classList.remove('selected');
        });
        document.querySelector(`[data-value="${value}"]`).classList.add('selected');
        document.getElementById('selected-chip').textContent = value;
    }

    placeBet(betType) {
        if (this.gameState !== 'betting') return;
        
        if (betType === 'bankerBonus') {
            // 加收下注：需要檢查是否有足夠餘額支付基本下注 + 50%加收
            const totalCost = this.selectedChip * 1.5; // 基本下注 + 50%加收
            if (this.balance < totalCost) {
                alert('餘額不足！加收下注需要額外50%費用');
                return;
            }
            
            const baseAmount = this.selectedChip;
            const feeAmount = this.selectedChip * 0.5;
            
            this.bets[betType] += totalCost;
            this.bankerBonusBase += baseAmount;
            this.balance -= totalCost;
            
            // 如果是第一次加收下注，生成隨機賠率但不立即顯示
            if (this.bonusMultiplier === null) {
                this.generateBonusMultiplier();
            }
        } else if (betType === 'bankerSuper') {
            // 超級加押：需要檢查是否有足夠餘額支付基本下注 + 400%加收
            const totalCost = this.selectedChip * 5; // 基本下注 + 400%加收
            if (this.balance < totalCost) {
                alert('餘額不足！超級加押需要額外400%費用');
                return;
            }
            
            const baseAmount = this.selectedChip;
            const feeAmount = this.selectedChip * 4;
            
            this.bets[betType] += totalCost;
            this.bankerSuperBase += baseAmount;
            this.balance -= totalCost;
            
            // 如果是第一次超級加押，生成隨機賠率但不立即顯示
            if (this.superMultiplier === null) {
                this.generateSuperMultiplier();
            }
        } else {
            // 普通下注
            if (this.balance < this.selectedChip) {
                alert('餘額不足！');
                return;
            }
            
            this.bets[betType] += this.selectedChip;
            this.balance -= this.selectedChip;
        }
        
        this.updateUI();
    }

    generateBonusMultiplier() {
        // 計算總權重
        const totalWeight = this.bonusPayoutTable.reduce((sum, item) => sum + item.weight, 0);
        
        // 生成隨機數
        const random = Math.random() * totalWeight;
        
        // 根據權重選擇賠率
        let currentWeight = 0;
        for (const payout of this.bonusPayoutTable) {
            currentWeight += payout.weight;
            if (random <= currentWeight) {
                this.bonusMultiplier = payout.multiplier;
                break;
            }
        }
        
        // 不在這裡顯示賠率，等到發牌時才顯示
    }

    generateSuperMultiplier() {
        // 計算總權重
        const totalWeight = this.superPayoutTable.reduce((sum, item) => sum + item.weight, 0);
        
        // 生成隨機數
        const random = Math.random() * totalWeight;
        
        // 根據權重選擇賠率
        let currentWeight = 0;
        for (const payout of this.superPayoutTable) {
            currentWeight += payout.weight;
            if (random <= currentWeight) {
                this.superMultiplier = payout.multiplier;
                break;
            }
        }
        
        // 不在這裡顯示賠率，等到發牌時才顯示
    }

    showBonusOdds() {
        // 顯示加收賠率
        if (this.bonusMultiplier) {
            const oddsDisplay = document.getElementById('banker-bonus-odds-display');
            const oddsValue = document.getElementById('banker-odds-value');
            
            oddsValue.textContent = `1:${this.bonusMultiplier}`;
            oddsDisplay.style.display = 'block';
        }
        
        // 顯示超級加押賠率
        if (this.superMultiplier) {
            const superOddsDisplay = document.getElementById('banker-super-odds-display');
            const superOddsValue = document.getElementById('banker-super-odds-value');
            
            superOddsValue.textContent = `1:${this.superMultiplier}`;
            superOddsDisplay.style.display = 'block';
        }
    }

    hideBonusOdds() {
        const oddsDisplay = document.getElementById('banker-bonus-odds-display');
        const superOddsDisplay = document.getElementById('banker-super-odds-display');
        const breakdownElement = document.getElementById('banker-bonus-breakdown');
        const superBreakdownElement = document.getElementById('banker-super-breakdown');
        
        oddsDisplay.style.display = 'none';
        superOddsDisplay.style.display = 'none';
        breakdownElement.style.display = 'none';
        superBreakdownElement.style.display = 'none';
    }

    clearBets() {
        if (this.gameState !== 'betting') return;
        
        // 返還下注金額
        this.balance += this.bets.banker + this.bets.player + this.bets.tie + this.bets.bankerBonus + this.bets.bankerSuper;
        this.bets = { banker: 0, player: 0, tie: 0, bankerBonus: 0, bankerSuper: 0 };
        this.bankerBonusBase = 0;
        this.bankerSuperBase = 0;
        this.bonusMultiplier = null;
        this.superMultiplier = null;
        this.hideBonusOdds();
        this.updateUI();
    }

    repeatLastBet() {
        if (this.gameState !== 'betting') return;
        if (this.lastBets.banker === 0 && this.lastBets.player === 0 && this.lastBets.tie === 0 && this.lastBets.bankerBonus === 0 && this.lastBets.bankerSuper === 0) {
            alert('沒有上次下注記錄！');
            return;
        }

        const totalLastBet = this.lastBets.banker + this.lastBets.player + this.lastBets.tie + this.lastBets.bankerBonus + this.lastBets.bankerSuper;
        if (this.balance < totalLastBet) {
            alert('餘額不足以重複上次下注！');
            return;
        }

        // 清除當前下注並返還金額
        this.balance += this.bets.banker + this.bets.player + this.bets.tie + this.bets.bankerBonus + this.bets.bankerSuper;
        
        // 應用上次的下注
        this.bets = { ...this.lastBets };
        this.bankerBonusBase = this.lastBankerBonusBase;
        this.bankerSuperBase = this.lastBankerSuperBase;
        this.balance -= totalLastBet;
        
        // 如果有莊家加收下注，需要重新生成賠率但不顯示
        if (this.bets.bankerBonus > 0) {
            this.generateBonusMultiplier();
        }
        
        // 如果有超級加押，需要重新生成賠率但不顯示
        if (this.bets.bankerSuper > 0) {
            this.generateSuperMultiplier();
        }
        
        this.updateUI();
    }

    dealCards() {
        if (this.gameState !== 'betting') return;
        if (this.bets.banker === 0 && this.bets.player === 0 && this.bets.tie === 0 && this.bets.bankerBonus === 0 && this.bets.bankerSuper === 0) {
            alert('請先下注！');
            return;
        }

        // 儲存本次下注作為下次的參考
        this.lastBets = { ...this.bets };
        this.lastBankerBonusBase = this.bankerBonusBase;
        this.lastBankerSuperBase = this.bankerSuperBase;

        this.gameState = 'dealing';
        this.currentCards = { banker: [], player: [] };
        
        // 如果有加收下注或超級加押，顯示賠率
        if ((this.bets.bankerBonus > 0 && this.bonusMultiplier) || (this.bets.bankerSuper > 0 && this.superMultiplier)) {
            this.showBonusOdds();
        }
        
        // 清空牌區
        document.getElementById('banker-cards').innerHTML = '';
        document.getElementById('player-cards').innerHTML = '';
        
        // 發牌動畫
        setTimeout(() => this.dealInitialCards(), 500);
    }

    dealInitialCards() {
        // 閒家先拿兩張牌
        this.currentCards.player.push(this.drawCard());
        this.currentCards.player.push(this.drawCard());
        
        // 莊家拿兩張牌
        this.currentCards.banker.push(this.drawCard());
        this.currentCards.banker.push(this.drawCard());
        
        this.initializeCardsDisplay();
        this.updateScores();
        
        // 檢查是否需要第三張牌
        setTimeout(() => this.checkThirdCard(), 1000);
    }

    drawCard() {
        // 檢查是否需要重新洗牌
        this.checkAndReshuffleIfNeeded();
        
        // 如果牌組為空（理論上不應該發生，但作為安全檢查）
        if (this.shoe.length === 0) {
            console.error('牌組為空！重新初始化...');
            this.initializeShoe();
        }
        
        // 從鞋牌頂部抽一張牌
        const card = this.shoe.pop();
        
        // 調試信息
        console.log(`抽牌: ${card.value}${card.suit}, 剩餘: ${this.shoe.length} 張`);
        
        return card;
    }

    getCardValue(card) {
        if (card.value === 'A') return 1;
        if (['J', 'Q', 'K'].includes(card.value)) return 0;
        return parseInt(card.value) || 10;
    }

    calculateScore(cards) {
        const total = cards.reduce((sum, card) => sum + this.getCardValue(card), 0);
        return total % 10;
    }

    displayCards() {
        this.displayCardsForSide('player');
        this.displayCardsForSide('banker');
    }

    initializeCardsDisplay() {
        // 清空牌區並顯示初始牌
        document.getElementById('player-cards').innerHTML = '';
        document.getElementById('banker-cards').innerHTML = '';
        
        // 顯示前兩張牌
        this.displayCardsForSide('player');
        this.displayCardsForSide('banker');
    }

    displayCardsForSide(side) {
        const container = document.getElementById(`${side}-cards`);
        const currentCardCount = container.children.length;
        const totalCards = this.currentCards[side].length;
        
        // 只顯示新增的牌
        for (let i = currentCardCount; i < totalCards; i++) {
            setTimeout(() => {
                const cardElement = this.createCardElement(this.currentCards[side][i]);
                container.appendChild(cardElement);
            }, (i - currentCardCount) * 300);
        }
    }

    createCardElement(card) {
        const cardDiv = document.createElement('div');
        cardDiv.className = 'card';
        if (card.suit === '♥' || card.suit === '♦') {
            cardDiv.classList.add('red');
        }
        
        cardDiv.innerHTML = `
            <div class="card-value">${card.value}</div>
            <div class="card-suit">${card.suit}</div>
        `;
        
        return cardDiv;
    }

    updateScores() {
        const playerScore = this.calculateScore(this.currentCards.player);
        const bankerScore = this.calculateScore(this.currentCards.banker);
        
        document.getElementById('player-score').textContent = playerScore;
        document.getElementById('banker-score').textContent = bankerScore;
    }

    checkThirdCard() {
        const playerScore = this.calculateScore(this.currentCards.player);
        const bankerScore = this.calculateScore(this.currentCards.banker);
        
        let playerThirdCard = null;
        let needBankerThird = false;
        
        // 自然贏（8或9點）
        if (playerScore >= 8 || bankerScore >= 8) {
            this.finishGame();
            return;
        }
        
        // 閒家第三張牌規則
        if (playerScore <= 5) {
            playerThirdCard = this.drawCard();
            this.currentCards.player.push(playerThirdCard);
        }
        
        // 莊家第三張牌規則
        const playerThirdValue = playerThirdCard ? this.getCardValue(playerThirdCard) : null;
        
        if (bankerScore <= 2) {
            needBankerThird = true;
        } else if (bankerScore === 3 && playerThirdValue !== 8) {
            needBankerThird = true;
        } else if (bankerScore === 4 && playerThirdValue >= 2 && playerThirdValue <= 7) {
            needBankerThird = true;
        } else if (bankerScore === 5 && playerThirdValue >= 4 && playerThirdValue <= 7) {
            needBankerThird = true;
        } else if (bankerScore === 6 && playerThirdValue >= 6 && playerThirdValue <= 7) {
            needBankerThird = true;
        } else if (bankerScore <= 5 && !playerThirdCard) {
            needBankerThird = true;
        }
        
        if (needBankerThird) {
            this.currentCards.banker.push(this.drawCard());
        }
        
        // 顯示第三張牌
        setTimeout(() => {
            this.displayCards();
            this.updateScores();
            setTimeout(() => this.finishGame(), 1000);
        }, 500);
    }

    finishGame() {
        this.gameState = 'finished';
        
        const playerScore = this.calculateScore(this.currentCards.player);
        const bankerScore = this.calculateScore(this.currentCards.banker);
        
        let result = '';
        let winnings = 0;
        
        if (playerScore > bankerScore) {
            result = 'player';
            winnings += this.bets.player * 2; // 1:1 賠率
            // 閒家贏時，加收下注和超級加押失敗，不返還任何金額
        } else if (bankerScore > playerScore) {
            result = 'banker';
            winnings += this.bets.banker * 1.95; // 1:0.95 賠率
            // 莊家贏時，加收下注獲勝：基本金額 × (1 + 賠率)
            if (this.bankerBonusBase > 0 && this.bonusMultiplier) {
                winnings += this.bankerBonusBase * (1 + this.bonusMultiplier);
            }
            // 莊家贏時，超級加押獲勝：基本金額 × (1 + 賠率)
            if (this.bankerSuperBase > 0 && this.superMultiplier) {
                winnings += this.bankerSuperBase * (1 + this.superMultiplier);
            }
        } else {
            result = 'tie';
            winnings += this.bets.tie * 9; // 1:8 賠率
            // 和局時退還莊家和閒家的下注
            winnings += this.bets.banker + this.bets.player;
            // 和局時只退還加收下注和超級加押的基本金額
            winnings += this.bankerBonusBase + this.bankerSuperBase;
        }
        
        this.balance += winnings;
        this.gameHistory.push(result);
        
        // 限制歷史記錄數量
        if (this.gameHistory.length > 20) {
            this.gameHistory.shift();
        }
        
        this.showResult(result, winnings);
        this.updateHistory();
    }

    showResult(result, winnings) {
        const popup = document.getElementById('result-popup');
        const title = document.getElementById('result-title');
        const message = document.getElementById('result-message');
        const winningsDisplay = document.getElementById('winnings');
        
        let resultText = '';
        let winningsText = '';
        
        if (result === 'player') {
            resultText = '閒家獲勝！';
        } else if (result === 'banker') {
            resultText = '莊家獲勝！';
        } else {
            resultText = '和局！';
        }
        
        const totalBet = this.bets.banker + this.bets.player + this.bets.tie + this.bets.bankerBonus + this.bets.bankerSuper;
        const profit = winnings - totalBet;
        
        if (profit > 0) {
            if (result === 'banker' && (this.bankerBonusBase > 0 || this.bankerSuperBase > 0)) {
                let detailText = '';
                if (this.bankerBonusBase > 0 && this.bonusMultiplier) {
                    const bonusTotal = this.bankerBonusBase * (1 + this.bonusMultiplier);
                    detailText += `加收: $${this.bankerBonusBase} × ${(1 + this.bonusMultiplier)} = $${bonusTotal.toFixed(2)}`;
                }
                if (this.bankerSuperBase > 0 && this.superMultiplier) {
                    const superTotal = this.bankerSuperBase * (1 + this.superMultiplier);
                    if (detailText) detailText += ', ';
                    detailText += `超級: $${this.bankerSuperBase} × ${(1 + this.superMultiplier)} = $${superTotal.toFixed(2)}`;
                }
                winningsText = `恭喜獲勝！贏得 $${profit.toFixed(2)} (${detailText})`;
            } else {
                winningsText = `恭喜獲勝！贏得 $${profit.toFixed(2)}`;
            }
        } else if (profit < 0) {
            // 輸錢時不顯示損失金額，只顯示結果
            if (result === 'player' && (this.bets.bankerBonus > 0 || this.bets.bankerSuper > 0)) {
                let failText = '';
                if (this.bets.bankerBonus > 0) failText += '加收下注失敗';
                if (this.bets.bankerSuper > 0) {
                    if (failText) failText += ', ';
                    failText += '超級加押失敗';
                }
                winningsText = failText;
            } else {
                winningsText = ``;
            }
        } else {
            winningsText = '平手，沒有輸贏';
            if (result === 'tie' && (this.bets.bankerBonus > 0 || this.bets.bankerSuper > 0)) {
                const bonusFeeLoss = this.bets.bankerBonus - this.bankerBonusBase;
                const superFeeLoss = this.bets.bankerSuper - this.bankerSuperBase;
                const totalFeeLoss = bonusFeeLoss + superFeeLoss;
                if (totalFeeLoss > 0) {
                    winningsText += ` (加收費用損失: $${totalFeeLoss.toFixed(2)})`;
                }
            }
        }
        
        title.textContent = resultText;
        message.textContent = `閒家: ${this.calculateScore(this.currentCards.player)} 點, 莊家: ${this.calculateScore(this.currentCards.banker)} 點`;
        winningsDisplay.textContent = winningsText;
        
        popup.style.display = 'flex';
    }

    continueGame() {
        document.getElementById('result-popup').style.display = 'none';
        this.newGame();
    }

    newGame() {
        this.gameState = 'betting';
        
        // 自動重複上次下注（如果有的話）
        const hasLastBets = this.lastBets.banker > 0 || this.lastBets.player > 0 || this.lastBets.tie > 0 || this.lastBets.bankerBonus > 0 || this.lastBets.bankerSuper > 0;
        if (hasLastBets) {
            const totalLastBet = this.lastBets.banker + this.lastBets.player + this.lastBets.tie + this.lastBets.bankerBonus + this.lastBets.bankerSuper;
            
            // 檢查餘額是否足夠重複下注
            if (this.balance >= totalLastBet) {
                // 自動應用上次的下注
                this.bets = { ...this.lastBets };
                this.bankerBonusBase = this.lastBankerBonusBase;
                this.bankerSuperBase = this.lastBankerSuperBase;
                this.balance -= totalLastBet;
                
                // 如果有莊家加收下注，重新生成賠率
                if (this.bets.bankerBonus > 0) {
                    this.generateBonusMultiplier();
                }
                
                // 如果有超級加押，重新生成賠率
                if (this.bets.bankerSuper > 0) {
                    this.generateSuperMultiplier();
                }
                
                // 顯示賠率（如果有加收下注或超級加押）
                if ((this.bets.bankerBonus > 0 && this.bonusMultiplier) || (this.bets.bankerSuper > 0 && this.superMultiplier)) {
                    this.showBonusOdds();
                }
            } else {
                // 餘額不足時清空下注
                this.bets = { banker: 0, player: 0, tie: 0, bankerBonus: 0, bankerSuper: 0 };
                this.bankerBonusBase = 0;
                this.bankerSuperBase = 0;
            }
        } else {
            // 沒有上次下注記錄時清空
            this.bets = { banker: 0, player: 0, tie: 0, bankerBonus: 0, bankerSuper: 0 };
            this.bankerBonusBase = 0;
            this.bankerSuperBase = 0;
            // 清除賠率
            this.bonusMultiplier = null;
            this.superMultiplier = null;
        }
        
        this.currentCards = { banker: [], player: [] };
        
        // 檢查牌組狀況
        this.checkAndReshuffleIfNeeded();
        
        // 清空牌區
        document.getElementById('banker-cards').innerHTML = '';
        document.getElementById('player-cards').innerHTML = '';
        document.getElementById('player-score').textContent = '0';
        document.getElementById('banker-score').textContent = '0';
        
        // 只有在沒有自動重複下注的情況下才隱藏賠率
        if (!hasLastBets || this.balance < (this.lastBets.banker + this.lastBets.player + this.lastBets.tie + this.lastBets.bankerBonus + this.lastBets.bankerSuper)) {
            this.hideBonusOdds();
        }
        
        // 清除下注區的高亮
        document.querySelectorAll('.bet-option').forEach(option => {
            option.classList.remove('active');
        });
        
        this.updateUI();
    }

    updateHistory() {
        const historyGrid = document.getElementById('history-grid');
        historyGrid.innerHTML = '';
        
        this.gameHistory.forEach(result => {
            const item = document.createElement('div');
            item.className = `history-item ${result}`;
            
            if (result === 'banker') {
                item.textContent = 'B';
            } else if (result === 'player') {
                item.textContent = 'P';
            } else {
                item.textContent = 'T';
            }
            
            historyGrid.appendChild(item);
        });
    }

    updateUI() {
        // 更新餘額
        document.getElementById('balance').textContent = this.balance.toFixed(2);
        
        // 更新剩餘牌數（如果有對應的UI元素）
        const cardsLeftElement = document.getElementById('cards-left');
        if (cardsLeftElement) {
            cardsLeftElement.textContent = `剩餘牌數: ${this.shoe.length}`;
            
            // 當牌數過少時顯示警告色
            if (this.shoe.length <= this.minCardsBeforeShuffle) {
                cardsLeftElement.style.color = '#ff6b6b';
            } else {
                cardsLeftElement.style.color = '#333';
            }
        }
        
        // 更新下注金額顯示
        document.getElementById('banker-bet').textContent = `$${this.bets.banker}`;
        document.getElementById('player-bet').textContent = `$${this.bets.player}`;
        document.getElementById('tie-bet').textContent = `$${this.bets.tie}`;
        document.getElementById('banker-bonus-bet').textContent = `$${this.bets.bankerBonus}`;
        document.getElementById('banker-super-bet').textContent = `$${this.bets.bankerSuper}`;
        
        // 更新加收下注明細
        const breakdownElement = document.getElementById('banker-bonus-breakdown');
        if (this.bets.bankerBonus > 0) {
            const feeAmount = this.bets.bankerBonus - this.bankerBonusBase;
            document.getElementById('base-amount').textContent = this.bankerBonusBase.toFixed(0);
            document.getElementById('fee-amount').textContent = feeAmount.toFixed(0);
            breakdownElement.style.display = 'block';
        } else {
            breakdownElement.style.display = 'none';
        }
        
        // 更新超級加押明細
        const superBreakdownElement = document.getElementById('banker-super-breakdown');
        if (this.bets.bankerSuper > 0) {
            const superFeeAmount = this.bets.bankerSuper - this.bankerSuperBase;
            document.getElementById('super-base-amount').textContent = this.bankerSuperBase.toFixed(0);
            document.getElementById('super-fee-amount').textContent = superFeeAmount.toFixed(0);
            superBreakdownElement.style.display = 'block';
        } else {
            superBreakdownElement.style.display = 'none';
        }
        
        // 更新下注區高亮
        document.querySelectorAll('.bet-option').forEach(option => {
            option.classList.remove('active');
        });
        
        if (this.bets.banker > 0) {
            document.getElementById('bet-banker').classList.add('active');
        }
        if (this.bets.player > 0) {
            document.getElementById('bet-player').classList.add('active');
        }
        if (this.bets.tie > 0) {
            document.getElementById('bet-tie').classList.add('active');
        }
        if (this.bets.bankerBonus > 0) {
            document.getElementById('bet-banker-bonus').classList.add('active');
        }
        if (this.bets.bankerSuper > 0) {
            document.getElementById('bet-banker-super').classList.add('active');
        }
        
        // 更新按鈕狀態
        const dealBtn = document.getElementById('deal-btn');
        const repeatBetBtn = document.getElementById('repeat-bet-btn');
        
        dealBtn.disabled = this.gameState !== 'betting';
        
        // 重複下注按鈕只有在下注階段且有上次下注記錄時才可用
        if (repeatBetBtn) {
            const hasLastBets = this.lastBets.banker > 0 || this.lastBets.player > 0 || this.lastBets.tie > 0 || this.lastBets.bankerBonus > 0 || this.lastBets.bankerSuper > 0;
            const totalLastBet = this.lastBets.banker + this.lastBets.player + this.lastBets.tie + this.lastBets.bankerBonus + this.lastBets.bankerSuper;
            repeatBetBtn.disabled = this.gameState !== 'betting' || !hasLastBets || this.balance < totalLastBet;
        }
        
        // 檢查是否沒錢了
        if (this.balance <= 0) {
            alert('遊戲結束！餘額不足，請重新開始遊戲。');
            this.balance = 1000;
            this.updateUI();
        }
    }
}

// 當頁面載入完成時啟動遊戲
document.addEventListener('DOMContentLoaded', () => {
    new BaccaratGame();
});