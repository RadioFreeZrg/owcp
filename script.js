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
const roles = ['damage', 'support', 'tank'];

document.addEventListener('DOMContentLoaded', function() {
    fetch('combined_data.json')
        .then(response => response.json())
        .then(characters => {
            globalCharacters = characters; // Store fetched characters globally
            initializeCharacterDisplay();
            setupDragAndDrop();
        })
        .catch(error => console.error('Error loading the JSON data:', error));
});

function initializeCharacterDisplay() {
    displayRolesWithDividers(globalCharacters, roles);
}

function displayRolesWithDividers(characters, roles) {
    const characterPortraits = document.getElementById('character-portraits');
    const numberOfDividers = roles.length - 1; // You will have one less divider than the number of roles
    const columnWidth = 100 / roles.length; // Assuming equal width for each column

    roles.forEach((role, index) => {
        displayCharactersByRole(characters, role);
        
        if (index < roles.length - 1) {
            const divider = document.createElement('div');
            divider.className = 'role-divider';
            // Adjust the percentage to account for the grid-gap and divider width if needed
            const leftPosition = (columnWidth * (index + 1)) - (columnWidth / 2);
            divider.style.left = `calc(${leftPosition}% + 305px)`; // Assuming the grid gap is 20px
            characterPortraits.appendChild(divider);
        }
    });
}

function setupDragAndDrop() {
    document.querySelectorAll('.character').forEach(character => {
        character.addEventListener('dragstart', function(e) {
            dragStart(e, character);
        });
    });

    document.querySelectorAll('.team-dropzone').forEach(zone => {
        zone.addEventListener('dragover', dragOver);
        zone.addEventListener('drop', drop);
    });
}

function dragStart(e, character) {
    e.dataTransfer.setData('text/plain', character.id);
    
    // Create a helper element for the drag image
    var dragIcon = document.createElement('img');
    dragIcon.src = character.querySelector('img').src; // Assuming the image you want to show during dragging is inside the character element
    dragIcon.width = 50; // Set the size of the drag image
    dragIcon.height = 50;
    document.body.appendChild(dragIcon); // Append to the body to make it part of the DOM
    dragIcon.style.position = 'absolute'; // Position it absolutely so it doesn't affect layout
    dragIcon.style.top = '-100px'; // Hide it from view initially

    // Use the helper element as the drag image
    // Note: The setDragImage offset coordinates might need to be adjusted based on your specific needs
    e.dataTransfer.setDragImage(dragIcon, 25, 25);

    // Clean up the dragIcon after the drag operation is complete
    setTimeout(() => document.body.removeChild(dragIcon), 0);
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
    updateDropzoneInstructionVisibility(document.getElementById('team1'));
    updateDropzoneInstructionVisibility(document.getElementById('team2'));

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

    // Initialize strongest and second strongest playstyle variables
    let strongestPlaystyle = '';
    let secondStrongestPlaystyle = '';
    let highestScore = 0;
    let secondHighestScore = 0;

    // Iterate over playstyleScores to find the strongest and second strongest playstyles
    for (const [playstyle, score] of Object.entries(playstyleScores)) {
        if (score > highestScore) {
            secondHighestScore = highestScore;
            secondStrongestPlaystyle = strongestPlaystyle;
            highestScore = score;
            strongestPlaystyle = playstyle;
        } else if (score > secondHighestScore) {
            secondHighestScore = score;
            secondStrongestPlaystyle = playstyle;
        }
    }

    // Determine if the composition is mixed based on the scores
    let isMixedComposition = Object.values(playstyleScores).every(score => score > 100) && !Object.values(playstyleScores).some(score => score > 400);

    let strongAgainst = '';
    let weakAgainst = '';

    // Define logic for determining strongAgainst and weakAgainst, accounting for mixed compositions
    if (!isMixedComposition) {
        // Example logic for determining strongAgainst and weakAgainst
        switch (strongestPlaystyle) {
            case 'brawl':
                strongAgainst = 'dive';
                weakAgainst = 'pick';
                break;
            case 'dive':
                strongAgainst = 'pick';
                weakAgainst = 'brawl';
                break;
            case 'pick':
                strongAgainst = 'brawl';
                weakAgainst = 'dive';
                break;
        }
    }

    // Return an object that includes whether the composition is mixed
    return {
        strongestPlaystyle: strongestPlaystyle,
        secondStrongestPlaystyle,
        strongAgainst,
        weakAgainst,
        isMixed: isMixedComposition
    };
}

function displayCompositionHeader(teamId, results) {
    const {
        strongestPlaystyle,
        secondStrongestPlaystyle,
        strongAgainst,
        weakAgainst,
        isMixed
    } = determineStrongestPlaystyle(results);

    let headerText;
    if (isMixed) {
        headerText = `This is a mixed composition, featuring elements primarily of ${strongestPlaystyle} and ${secondStrongestPlaystyle} playstyles. There is not a clear playstyle advantage, and the composition may struggle against more synergistic compositions.`;
    } else {
        headerText = `This is a ${strongestPlaystyle} composition. Strongest against ${strongAgainst} compositions and weakest against ${weakAgainst} compositions.`;
    }

    const analysisText = getPlaystyleAnalysis(strongestPlaystyle, strongAgainst, weakAgainst, isMixed, secondStrongestPlaystyle);

    // Update DOM elements
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

function getPlaystyleAnalysis(strongestPlaystyle, strongAgainst, weakAgainst, isMixed, secondStrongestPlaystyle) {
    let analysisText = '';
    if (isMixed) {
        analysisText = `This mixed composition offer flexibility by incorporating elements from ${strongestPlaystyle} and ${secondStrongestPlaystyle} playstyles. However, it may lack the specialized strengths of a focused strategy, potentially struggling against more cohesive team compositions. These teams should capitalize on their adaptability to secure advantages where possible.`;
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
        const metricValue = results.compositionFit[metric] ?? results.utilityScore;
        // Calculate percentage of the metric value relative to its maximum value
        const metricPercentage = (metricValue / maxValues[metric] * 100).toFixed(2);
        // For remaining value calculation, it's now 100 - metricPercentage since we're dealing with percentages
        const remainingPercentage = (100 - metricPercentage).toFixed(2);

        const data = {
            labels: [metric, 'Remaining'],
            datasets: [{
                data: [metricPercentage, remainingPercentage],
                backgroundColor: metricColors[metric].chart,
                borderColor: ['rgba(255,255,255,1)', 'rgba(255,255,255,1)'],
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
    // Update the displayed value to reflect the percentage of the primary metric score
    let valueDisplayElement = document.querySelector(`#${chartId}-value`);
    if (!valueDisplayElement) {
        valueDisplayElement = document.createElement('div');
        valueDisplayElement.id = `${chartId}-value`;
        element.parentElement.appendChild(valueDisplayElement);
    }
    // Ensure the displayed value matches the format "{Metric}: {Percentage}%"
    valueDisplayElement.innerHTML = `${metric.toUpperCase()}: ${data.datasets[0].data[0]}%`;
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
    const team1Data = determineStrongestPlaystyle(team1Results);
    const team2Data = determineStrongestPlaystyle(team2Results);

    // Apply standard RPS logic if both teams are mixed
    if (team1Data.isMixed && team2Data.isMixed) {
        compareUsingRPS(team1Data.strongestPlaystyle, team2Data.strongestPlaystyle);
    } else if (team1Data.isMixed && !team2Data.isMixed) {
        // Team 2 has a clear playstyle and thus has the advantage
        highlightTeam('team1', 'red');
        highlightTeam('team2', 'green');
    } else if (!team1Data.isMixed && team2Data.isMixed) {
        // Team 1 has a clear playstyle and thus has the advantage
        highlightTeam('team1', 'green');
        highlightTeam('team2', 'red');
    } else {
        // Standard RPS logic if neither team is mixed
        compareUsingRPS(team1Data.strongestPlaystyle, team2Data.strongestPlaystyle);
    }
}

function compareUsingRPS(team1StrongestPlaystyle, team2StrongestPlaystyle) {
    if (rpsMechanics[team1StrongestPlaystyle] === team2StrongestPlaystyle) {
        highlightTeam('team1', 'green');
        highlightTeam('team2', 'red');
    } else if (rpsMechanics[team2StrongestPlaystyle] === team1StrongestPlaystyle) {
        highlightTeam('team1', 'red');
        highlightTeam('team2', 'green');
    } else {
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
function updateDropzoneInstructionVisibility(dropZone) {
    const instruction = dropZone.querySelector('.dropzone-instruction');
    const hasCharacters = dropZone.querySelectorAll('.dropped-character').length > 0;
    instruction.style.visibility = hasCharacters ? 'hidden' : 'visible';
}
function displayCharactersByRole(characters, role) {
    const container = document.getElementById('character-portraits');
    
    // Create the role container
    const roleContainer = document.createElement('div');
    roleContainer.className = `role-container ${role}`;
    roleContainer.innerHTML = `<h2>${role.charAt(0).toUpperCase() + role.slice(1)} Characters</h2>`;
    const charactersDiv = document.createElement('div');
    charactersDiv.className = 'characters';

    // Append characters to the role-specific div
    characters.filter(character => character.role === role).forEach(character => {
        const characterDiv = document.createElement('div');
        characterDiv.className = 'character';
        characterDiv.setAttribute('draggable', 'true');
        characterDiv.setAttribute('id', character.name.replace(/\s+/g, '-').toLowerCase());
        characterDiv.setAttribute('data-character-name', character.name);
        characterDiv.innerHTML = `
            <img src="${character.portrait}" alt="${character.name}">
            <span>${character.name}</span>
        `;
        charactersDiv.appendChild(characterDiv);
    });

    roleContainer.appendChild(charactersDiv);
    container.appendChild(roleContainer);
}
