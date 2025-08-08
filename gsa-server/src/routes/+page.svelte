<script>
    import { onMount } from 'svelte';
    let progressData = {
        percent: 0, 
        unitIdentifier: 'N/A',
        currentUnit: 'N/A', 
        totalUnits: 0,
        currentUnitId: 'N/A', 
        total: 0, 
        isCompleted: false, 
        completed: 0
    };

    let error = '';

    $: barColor =
     (progressData.percent || 0) < 40
      ? '#f44336'
      : (progressData.percent || 0) < 70
      ? '#ff9800'
      : '#4caf50';

    onMount(() => {
        const evtSource = new EventSource('http://localhost:9090/gsa-enrichment-progress');

        evtSource.onmessage = (event) => {
            progressData = JSON.parse(event.data);
        };

        evtSource.onerror = () => {
            evtSource.close();
            const datetime = (date = '') => {
                const index = date.indexOf('GMT');
                return index !== -1 ? date.substring(0, index).trim() : date;
            }
            error = `[${datetime(new Date().toString())}]  Event source error occured`;
        };
    });
</script>

<div class="container">
  
    <div>
        <label for="enrichmentProgress">
            <h1>Enrichment Progress</h1>
        </label>
    </div>

    <div class="progress-container" style={`border: 1px solid ${barColor};`}>
        <div class="progress-bar" style={`width: ${progressData.percent}%; background-color: ${barColor};`}></div>
        <div class="label-container">
            <h4>{progressData.percent}%</h4>
        </div>
    </div>

    <div class="label">
        {progressData.completed || 0} of {progressData.total || 0} matches enriched
    </div>

    {#if error}
        <div style="margin-block 1.5em">{error}</div>
    {/if}

    <div class="detail-block-container">
        <div class="detail-block">
            <h4>Completed Units:</h4>
            <p>{progressData.currentUnit} of {progressData.totalUnits}</p>
        </div>
        <div class="detail-block">
            <h4>Current Processed Unit:</h4>
            <p>{progressData.unitIdentifier}</p>
        </div>
        <div class="detail-block">
            <h4>Current Unit ID:</h4>
            <p>{progressData.currentUnitId}</p>
        </div>
        <div class="detail-block">
            <h4>Is operation completed:</h4>
            <p>{ progressData.isCompleted ? 'Yes' : 'No' }</p>
        </div>
    </div>
</div>

<style>
    .container {
        max-width: 500px;
        margin: 80px auto;
        text-align: center;
        font-family: system-ui, sans-serif;
    }

    .progress-container {
        width: 100%;
        height: 35px;
        border-radius: 5px;
        overflow: hidden;
        padding: 3px;
        position: relative;
        background-color: beige;
    }

    .label-container {
        width: 100%;
        height: 100%;
        background: none;
        z-index: 5;
        color: #1e1f29;
        position: absolute;
        top: 0;
        left: 0;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .progress-bar {
        height: 100%;
        display: flex;
        border-radius: 5px;
        align-items: center;
        justify-content: center;
        transition: all 1s ease-in;
    }
    
    .label {
        margin-top: 10px;
        font-size: 1rem;
        color: #555;
    }

    .detail-block-container {
        padding-top: 3em;
    }

    .detail-block {
        width: 100%;
        display: flex;
        align-items: center;
    }

    .detail-block h4 {
        color: dimgray;
    }

    .detail-block p {
        color: #555;
        font-weight: 700;
        margin-left: 1.5em;
    }
</style>
