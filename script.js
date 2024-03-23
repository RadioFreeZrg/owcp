let globalCharacters = []; // Global variable to store character data
let team1 = [];
let team2 = [];
let chartInstances = {};
let metricColors = {
    brawl: {
        chart: ['rgba(128, 0, 128, 0.5)', 'rgba(128, 0, 128, 0.2)'], // Deep purple
        background: 'rgba(230, 230, 250, 1)' // Lavender
    },
    dive: {
        chart: ['rgba(0, 191, 255, 0.5)', 'rgba(0, 191, 255, 0.2)'], // Vibrant blue
        background: 'rgba(224, 255, 255, 1)' // Light Cyan
    },
    pick: {
        chart: ['rgba(220, 20, 60, 0.5)', 'rgba(220, 20, 60, 0.2)'], // Crimson
        background: 'rgba(255, 182, 193, 1)' // Pale Pink
    },
    utility: {
        chart: ['rgba(255, 255, 102, 0.5)', 'rgba(255, 255, 102, 0.2)'], // Pale yellow
        background: 'rgba(245, 245, 245, 1)' // Very light grey
    }
};
const rpsMechanics = {
    brawl: 'dive', // Brawl is strong against Dive
    dive: 'pick', // Dive is strong against Pick
    pick: 'brawl', // Pick is strong against Brawl
};

document.addEventListener('DOMContentLoaded', function() {
    fetch('combined_data.json')
        .then(response => response.json())
        .then(characters => {
            globalCharacters = characters; // Store fetched characters globally
            displayCharactersByRole(characters, 'damage');
            displayCharactersByRole(characters, 'support');
            displayCharactersByRole(characters, 'tank');
            setupDragAndDrop();
        })
        .catch(error => console.error('Error loading the JSON data:', error));
});

function displayCharactersByRole(characters, role) {
    const container = document.getElementById('character-portraits');
    const roleContainer = document.createElement('div');
    roleContainer.className = `role-container ${role}`;
    roleContainer.innerHTML = `<h2>${role.charAt(0).toUpperCase() + role.slice(1)} Characters</h2><div class="characters"></div>`;
    container.appendChild(roleContainer);

    const charactersDiv = roleContainer.querySelector('.characters');
    characters.filter(character => character.role === role).forEach(character => {
        const characterDiv = document.createElement('div');
        characterDiv.className = 'character';
        characterDiv.setAttribute('draggable', true);
        characterDiv.setAttribute('id', character.name.replace(/\s+/g, '-').toLowerCase());
        characterDiv.setAttribute('data-character-name', character.name); // For identification in drop
        characterDiv.innerHTML = `
            <img src="${character.portrait}" alt="${character.name}">
            <span>${character.name}</span>
        `;
        charactersDiv.appendChild(characterDiv);
    });
}

function setupDragAndDrop() {
    document.getElementById('character-portraits').addEventListener('dragstart', function(e) {
        if (e.target && e.target.matches('.character')) {
            dragStart(e);
        }
    });

    document.querySelectorAll('.team-dropzone').forEach(zone => {
        zone.addEventListener('dragover', dragOver);
        zone.addEventListener('drop', drop);
    });
}

function dragStart(e) {
    e.dataTransfer.setData('text/plain', e.target.id);
}

function dragOver(e) {
    e.preventDefault();
}

function drop(e) {
    e.preventDefault();
    const characterId = e.dataTransfer.getData('text/plain').replace('-clone', '');
    // Find the nearest ancestor drop zone of the event target
    const dropZone = e.target.closest('.team-dropzone');
    if (!dropZone) {
        console.error('Drop zone not found');
        return;
    }

    // Correctly retrieve the 'data-team' attribute to define 'teamNumber'
    const teamNumber = dropZone.getAttribute('data-team');

    if (!teamNumber) {
        console.error('Invalid team number or drop zone not found');
        return;
    }

    const characterData = globalCharacters.find(character => character.name.replace(/\s+/g, '-').toLowerCase() === characterId);

    if (!characterData) {
        console.error('Character data not found for:', characterId);
        return;
    }

    // Determine which team array to update based on teamNumber
    const teamArray = teamNumber === '1' ? team1 : teamNumber === '2' ? team2 : null;

    if (!teamArray) {
        console.error('Invalid team number:', teamNumber);
        return;
    }

    if (teamArray.some(c => c.name === characterData.name)) {
        console.log('Character already in team:', characterData.name);
        return;
    }
    // Validation for team composition based on roles
    const roleCounts = teamArray.reduce((acc, curr) => {
        acc[curr.role] = (acc[curr.role] || 0) + 1;
        return acc;
    }, {});

    // Setting limits for each role
    const roleLimits = { damage: 2, support: 2, tank: 1 };
    if (roleCounts[characterData.role] >= roleLimits[characterData.role]) {
        alert(`Cannot add more than ${roleLimits[characterData.role]} ${characterData.role} characters to a team.`);
        return;
    }

    // If validation passes, add character to team
    teamArray.push(characterData);
    appendCharacterToDropZone(dropZone, characterData);

    // After updating the team, regenerate the chart
    showResults();
}
function appendCharacterToDropZone(dropZone, characterData, characterId) {
    // Create a new div to represent the character in the drop zone
    const characterElement = document.createElement('div');
    characterElement.className = 'dropped-character';
    characterElement.id = `${characterId}-in-zone`; // Assign a new unique ID

    // Add the character's portrait and name
    characterElement.innerHTML = `
        <img src="${characterData.portrait}" alt="${characterData.name}" class="character-portrait">
        <span class="character-name">${characterData.name}</span>
        <div class="remove-character">X</div> <!-- Removal icon -->
    `;

    // Append the new character element to the drop zone
    dropZone.appendChild(characterElement);
    characterElement.addEventListener('click', function() {
        removeCharacterFromDropZone(dropZone, characterData, characterElement);
    });
}
function evaluateTeam(team) {
    const evaluation = {
        hitpoints: { health: 0, shields: 0, armor: 0, total: 0 },
        compositionFit: { brawl: 0, dive: 0, pick: 0 },
        utilityScore: 0
    };

    const utilityWeights = {
        ultimate: 4,
        cooldown: 3,
        'primary fire': 2,
        melee: 1
    };

    team.forEach(character => {
        evaluation.hitpoints.health += character.hitpoints.health;
        evaluation.hitpoints.shields += character.hitpoints.shields;
        evaluation.hitpoints.armor += character.hitpoints.armor;
        evaluation.hitpoints.total += character.hitpoints.total;

        evaluation.compositionFit.brawl += character['composition fit'].brawl;
        evaluation.compositionFit.dive += character['composition fit'].dive;
        evaluation.compositionFit.pick += character['composition fit'].pick;

        Object.keys(character.utility).forEach(key => {
            const utilityType = character.utility[key];
            if (utilityWeights[utilityType] !== undefined) {
                evaluation.utilityScore += utilityWeights[utilityType];
            }
        });
    });

    evaluation.utilityScore = evaluation.utilityScore / team.length; // Corrected teamSize reference

    return evaluation;
}

console.log(team1); // Should log an array of objects
console.log(team2); // Should log an array of objects

function showResults() {
    const team1Results = evaluateTeam(team1);
    console.log(team1Results.compositionFit); // Should show { brawl: X, dive: Y, pick: Z }
    const team2Results = evaluateTeam(team2);
    console.log(team2Results.compositionFit); // Should show { brawl: X, dive: Y, pick: Z }

     // Display or remove composition headers based on team sizes
     if (team1.length === 5) {
        displayCompositionHeader('team1', team1Results);
    } else {
        removeCompositionHeader('team1');
    }
    if (team2.length === 5) {
        displayCompositionHeader('team2', team2Results);
    } else {
        removeCompositionHeader('team2');
    }
    // Update charts for both teams
    updateDoughnutCharts('team1-chart', team1Results);
    updateDoughnutCharts('team2-chart', team2Results);
    highlightCompositionAdvantage(team1Results, team2Results);

}
function removeCompositionHeader(teamId) {
    const analysisContainerId = `${teamId}-analysis`; // Assuming an analysis container exists
    const analysisContainer = document.getElementById(analysisContainerId);
    if (analysisContainer) {
        const existingHeader = analysisContainer.querySelector('h2');
        if (existingHeader) analysisContainer.removeChild(existingHeader);
    }
}

function displayCompositionHeader(teamId, results) {
    const { strongestPlaystyle, strongAgainst } = determineStrongestPlaystyle(results);

    const headerText = `This is a ${strongestPlaystyle} composition. It is strongest against a ${strongAgainst} composition.`;
    const headerElement = document.createElement('h2');
    headerElement.textContent = headerText;

    const analysisText = getPlaystyleAnalysis(strongestPlaystyle, strongAgainst);
    const analysisParagraph = document.createElement('p');
    analysisParagraph.textContent = analysisText;

    const analysisContainerId = `${teamId}-analysis`;
    const analysisContainer = document.getElementById(analysisContainerId);
    if (analysisContainer) {
        const existingHeader = analysisContainer.querySelector('h2');
        if (existingHeader) analysisContainer.removeChild(existingHeader);

        const existingParagraph = analysisContainer.querySelector('p');
        if (existingParagraph) analysisContainer.removeChild(existingParagraph);

        analysisContainer.appendChild(headerElement);
        analysisContainer.appendChild(analysisParagraph);
    }
}

function getPlaystyleAnalysis(strongestPlaystyle, strongAgainst) {
    let analysisText = '';
    switch(strongestPlaystyle) {
        case 'brawl':
            analysisText = 'Brawl compositions excel in close-quarters combat and sustain, making them particularly effective against Dive compositions that rely on quick engagements and high mobility.';
            break;
        case 'dive':
            analysisText = 'Dive compositions are great at disrupting enemy lines and targeting key backline heroes, giving them an edge over Pick compositions that depend on positioning and ranged damage.';
            break;
        case 'pick':
            analysisText = 'Pick compositions focus on securing early eliminations with precision damage, making them strong against Brawl compositions that depend on grouped formations and sustain.';
            break;
    }
    return analysisText;
}
function determineStrongestPlaystyle(results) {
    const playstyleScores = {
        brawl: results.compositionFit.brawl,
        dive: results.compositionFit.dive,
        pick: results.compositionFit.pick
    };

    let isMixedComposition = Object.values(playstyleScores).every(score => score > 100) &&
                             Object.values(playstyleScores).every(score => score < 400);

    let strongestPlaystyle = '';
    let secondStrongestPlaystyle = '';
    let highestScore = 0;
    let secondHighestScore = 0;

    for (const [playstyle, score] of Object.entries(playstyleScores)) {
        if (score > highestScore) {
            secondHighestScore = highestScore; // Previous highest becomes second highest
            secondStrongestPlaystyle = strongestPlaystyle; // Update second strongest
            highestScore = score;
            strongestPlaystyle = playstyle;
        } else if (score > secondHighestScore) {
            secondHighestScore = score;
            secondStrongestPlaystyle = playstyle;
        }
    }

    let strongAgainst = '';
    if (isMixedComposition) {
        return {
            strongestPlaystyle: 'mixed',
            secondStrongestPlaystyle: secondStrongestPlaystyle,
            isMixed: true
        };
    } else {
        // Original logic for determining the playstyle it is strongest against
        switch (strongestPlaystyle) {
            case 'brawl':
                strongAgainst = 'dive';
                break;
            case 'dive':
                strongAgainst = 'pick';
                break;
            case 'pick':
                strongAgainst = 'brawl';
                break;
        }
    }

    return { strongestPlaystyle, strongAgainst, isMixed: false };
}

function displayCompositionHeader(teamId, results) {
    const { strongestPlaystyle, strongAgainst, weakestPlaystyle, weakAgainst, isMixed, secondStrongestPlaystyle } = determineStrongestPlaystyle(results);

    let headerText = '';
    if (isMixed) {
        headerText = `This is a mixed composition, featuring elements of ${secondStrongestPlaystyle}. There is not a clear playstyle advantage, and the composition may struggle against more synergistic compositions.`;
    } else {
        headerText = `This is a ${strongestPlaystyle} composition. Strongest against ${strongAgainst} compositions and weakest against ${weakAgainst} compositions.`;
    }

    // Assuming getPlaystyleAnalysis is a function that returns a string of analysis text based on the playstyle strengths and weaknesses
    let analysisText = '';
    if (isMixed) {
        analysisText = "Mixed compositions can offer versatility but may lack the focused strategy that pure playstyle compositions offer. Maximizing synergy within the chosen elements of each playstyle is crucial.";
    } else {
        analysisText = getPlaystyleAnalysis(strongestPlaystyle, strongAgainst, weakestPlaystyle, weakAgainst);
    }

    const headerElement = document.createElement('h2');
    headerElement.textContent = headerText;

    const analysisParagraph = document.createElement('p');
    analysisParagraph.textContent = analysisText;

    const analysisContainerId = `${teamId}-analysis`;
    const analysisContainer = document.getElementById(analysisContainerId);
    if (analysisContainer) {
        const existingHeader = analysisContainer.querySelector('h2');
        if (existingHeader) analysisContainer.removeChild(existingHeader);

        const existingParagraph = analysisContainer.querySelector('p');
        if (existingParagraph) analysisContainer.removeChild(existingParagraph);

        analysisContainer.appendChild(headerElement);
        analysisContainer.appendChild(analysisParagraph);
    }
}

function getPlaystyleAnalysis(strongestPlaystyle, strongAgainst, weakestPlaystyle, weakAgainst, isMixed, secondStrongestPlaystyle) {
    let analysisText = '';

    if (isMixed) {
        analysisText = `Mixed compositions offer a balanced approach but may lack the cohesiveness of a focused strategy. They can adapt to more situations but may not have the overwhelming advantage in any single aspect. Against ${strongAgainst} compositions, the mixed elements provide versatility, yet against ${weakAgainst} compositions, finding and exploiting specific weaknesses becomes crucial. Ensuring that the chosen elements from each playstyle work well together and complement each other's strengths will be key to overcoming more synergistic enemy compositions.`;
    } else {
        switch(strongestPlaystyle) {
            case 'brawl':
                analysisText = `The Brawl composition is effective at close quarters and sustained combat, making it strong against Dive compositions that rely on quick engagements. Brawl can resist the initial burst and counter-attack. However, it struggles against Pick compositions, which can eliminate key targets from a distance before Brawl can close in. It relies on player awareness to negate burst damage and ensure your team remains at full strength until it secures a kill that generates advantage, allowing the team with more living players to engage with more aggression while the odds of success for the other team are lower.`;
                break;
            case 'dive':
                analysisText = `The Dive composition uses high mobility to quickly engage and eliminate priority targets, making it effective against Pick compositions that rely on precision from a distance. Dive can close the gap before Picks can secure eliminations. However, it's weaker against Brawl compositions, which can sustain the initial assault and counter-attack in close quarters. It requires a large amount of coordination and map awareness from all players to execute effectively.`;
                break;
            case 'pick':
                analysisText = `The Pick composition focuses on eliminating key targets with precision damage, making it strong against Brawl compositions that cluster together, allowing for impactful picks. However, it struggles against Dive compositions, whose mobility allows them to evade Pick's damage and close the distance quickly. This composition relies on a high degree of mechanical skill from damage players and viligant awareness on the part of support and tank players.`;
                break;
        }
    }

    return analysisText;
}


function getChartOptions(type, metric) {
    // Customize this based on the chart type and specific metric
    const commonOptions = {
        responsive: true,
        maintainAspectRatio: true,
        backgroundColor: metricColors[metric].background, // Set the background color for the chart
        plugins: {
            legend: { display: false },
            title: { 
                display: true, 
                text: metric.toUpperCase(),
            }
        },
    };

    if (type === 'doughnut') {
        return {
            ...commonOptions,
            circumference: 360,
            rotation: 0,
            cutout: '50%',
            // Example of adding data labels plugin configuration
            plugins: {
                ...commonOptions.plugins,
                datalabels: {
                    display: true,
                    color: '#fff',
                    formatter: (value, ctx) => {
                        return ctx.dataIndex === 0 ? `${value}` : '';
                    },
                },
            },
        };
    }
    // Add other chart type configurations here
    return commonOptions;
}

function updateDoughnutCharts(teamNumber, results) {
    const metrics = ['brawl', 'dive', 'pick', 'utility'];
    const maxValues = { brawl: 500, dive: 500, pick: 500, utility: 20 };
    metrics.forEach(metric => {
        const chartId = `${teamNumber}-${metric}`;
        const maxValue = maxValues[metric];
        const metricValue = results.compositionFit[metric] ?? results.utilityScore;
        const remainingValue = maxValue - metricValue;

        const data = {
            labels: [metric, 'Remaining'],
            datasets: [{
                data: [results.compositionFit[metric] ?? results.utilityScore, maxValues[metric] - (results.compositionFit[metric] ?? results.utilityScore)],
                backgroundColor: metricColors[metric].chart,
                borderColor: ['rgba(255,255,255,1)', 'rgba(255,255,255,1)'], // White borders for clarity
                borderWidth: 2
            }]
        };

        updateOrCreateChart(chartId, data, 'doughnut', metric);
    });
}

function updateOrCreateChart(chartId, data, type, metric) {
    const element = document.getElementById(chartId);
    if (!element) {
        console.error('Canvas element not found:', chartId);
        return;
    }
    const ctx = element.getContext('2d');
    const valueToDisplay = data.datasets[0].data[0];

    const options = getChartOptions(type, metric);

    if (chartInstances[chartId]) {
        chartInstances[chartId].data = data;
        chartInstances[chartId].options = options; // Ensure options are updated too
        chartInstances[chartId].update();
    } else {
        chartInstances[chartId] = new Chart(ctx, {
            type,
            data,
            options,
        });
    }
    let valueDisplayElement = document.querySelector(`#${chartId}-value`);
    if (!valueDisplayElement) {
        valueDisplayElement = document.createElement('div');
        valueDisplayElement.id = `${chartId}-value`;
        element.parentElement.appendChild(valueDisplayElement);
    }
    valueDisplayElement.innerHTML = `${metric.toUpperCase()}: ${valueToDisplay}`;
}
function closeOverlay() {
    document.getElementById('overlay').style.display = 'none';
}
function removeCharacterFromDropZone(dropZone, characterData, characterElement) {
    // Determine team based on drop zone's 'data-team' attribute
    const teamNumber = dropZone.getAttribute('data-team');
    const teamArray = teamNumber === '1' ? team1 : teamNumber === '2' ? team2 : null;

    if (!teamArray) {
        console.error('Invalid team number:', teamNumber);
        return;
    }

    // Remove character from team array
    const index = teamArray.findIndex(c => c.name === characterData.name);
    if (index !== -1) {
        teamArray.splice(index, 1);
    }

    // Remove character element from DOM
    characterElement.remove();

    // Optionally, update charts or other UI elements as necessary
    showResults();
}
document.getElementById('how-to-use-btn').onclick = function() {
    document.getElementById('how-to-use-overlay').style.display = 'block';
    appendCharacterImagesForPlaystyle('brawl');
    appendCharacterImagesForPlaystyle('dive');
    appendCharacterImagesForPlaystyle('pick');
}

function closeHowToUseOverlay() {
    document.getElementById('how-to-use-overlay').style.display = 'none';
}
function appendCharacterImagesForPlaystyle(playstyle) {
    const playstyleDiv = document.getElementById(`${playstyle}-playstyle`);
    // Filter characters that have a score of 100 for the given playstyle
    const charactersForPlaystyle = globalCharacters.filter(character => character['composition fit'][playstyle] === 100);

    charactersForPlaystyle.forEach(character => {
        const img = document.createElement('img');
        img.src = character.portrait;
        img.alt = character.name;
        img.className = 'playstyle-image'; // Ensure you have CSS for this class
        playstyleDiv.appendChild(img);
    });
}
function highlightCompositionAdvantage(team1Results, team2Results) {
    const { strongestPlaystyle: team1StrongestPlaystyle } = determineStrongestPlaystyle(team1Results);
    const { strongestPlaystyle: team2StrongestPlaystyle } = determineStrongestPlaystyle(team2Results);

    // Check for mixed compositions directly
    if (team1StrongestPlaystyle === "mixed" && team2StrongestPlaystyle !== "mixed") {
        // Team 2 has the advantage if it is not a mixed composition
        highlightTeam('team1', 'red');
        highlightTeam('team2', 'green');
    } else if (team2StrongestPlaystyle === "mixed" && team1StrongestPlaystyle !== "mixed") {
        // Team 1 has the advantage if it is not a mixed composition
        highlightTeam('team1', 'green');
        highlightTeam('team2', 'red');
    } else if (team1StrongestPlaystyle !== "mixed" && team2StrongestPlaystyle !== "mixed") {
        // If neither team is a mixed composition, check RPS mechanics
        if (rpsMechanics[team1StrongestPlaystyle] === team2StrongestPlaystyle) {
            // Team 1 has the advantage
            highlightTeam('team1', 'green');
            highlightTeam('team2', 'red');
        } else if (rpsMechanics[team2StrongestPlaystyle] === team1StrongestPlaystyle) {
            // Team 2 has the advantage
            highlightTeam('team1', 'red');
            highlightTeam('team2', 'green');
        } else {
            // No clear advantage or disadvantage
            highlightTeam('team1', 'grey');
            highlightTeam('team2', 'grey');
        }
    } else {
        // Both teams are mixed compositions or the matchup does not follow RPS mechanics directly
        highlightTeam('team1', 'grey');
        highlightTeam('team2', 'grey');
    }
}

function highlightTeam(teamId, color) {
    const analysisContainerId = `${teamId}-analysis`;
    const analysisContainer = document.getElementById(analysisContainerId);
    if (analysisContainer) {
        analysisContainer.style.borderColor = color;
        analysisContainer.style.borderWidth = "2px";
        analysisContainer.style.borderStyle = "solid";
    }
}