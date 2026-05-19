function gotoRegister() {
    window.location.href = "pages/Registration.html";
}

function loadLeaderboard() {
    fetch("/api/leaderboard")
        .then(res => res.json())
        .then(data => {
            const tbody = document.getElementById("leaderboardBody");
            tbody.innerHTML = "";

            if (data.length === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="6" class="no-data">No sit-in data available yet.</td>
                    </tr>
                `;
                return;
            }

            data.forEach((student, index) => {
                const rank = index + 1;
                let rankClass = "rank-other";
                let rankText = rank;

                if (rank === 1) {
                    rankClass = "rank-1";
                    rankText = "🥇";
                } else if (rank === 2) {
                    rankClass = "rank-2";
                    rankText = "🥈";
                } else if (rank === 3) {
                    rankClass = "rank-3";
                    rankText = "🥉";
                }

                const tr = document.createElement("tr");
                tr.className = "leaderboard-row";

                // Profile picture or initials circle fallback
                let imgHtml = "";
                if (student.profile_picture) {
                    let imgSrc = student.profile_picture;
                    if (!imgSrc.startsWith('data:') && !imgSrc.startsWith('http') && !imgSrc.startsWith('/')) {
                        imgSrc = '/' + imgSrc;
                    }
                    imgHtml = `<img class="leaderboard-avatar" src="${imgSrc}" alt="${student.student_name}" onerror="this.outerHTML='<div class=&quot;leaderboard-avatar-fallback&quot;>${student.student_name.charAt(0)}</div>'">`;
                } else {
                    imgHtml = `<div class="leaderboard-avatar-fallback">${student.student_name.charAt(0)}</div>`;
                }

                tr.innerHTML = `
                    <td><span class="rank-badge ${rankClass}">${rankText}</span></td>
                    <td style="font-weight: 600; display: flex; align-items: center; gap: 12px; border-bottom: none;">
                        ${imgHtml}
                        <span>${student.student_name}</span>
                    </td>
                    <td style="color: #666; font-family: monospace;">${student.student_id}</td>
                    <td><span class="session-count">${student.count} sessions</span></td>
                    <td style="font-weight: 500; color: #4b5563;">${student.total_time_formatted}</td>
                    <td><span class="points-badge">✨ ${student.points} pts</span></td>
                `;
                tbody.appendChild(tr);
            });
        })
        .catch(err => {
            console.error("Error loading leaderboard:", err);
            document.getElementById("leaderboardBody").innerHTML = `
                <tr>
                    <td colspan="6" class="no-data" style="color: red;">Failed to load leaderboard data.</td>
                </tr>
            `;
        });
}

// Initial load
loadLeaderboard();

// Auto-refresh every 30 seconds
setInterval(loadLeaderboard, 30000);
