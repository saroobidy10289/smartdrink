import usePetriStore from '../store/usePetriStore';

function computeMatrices(nodes, edges) {
  const places = nodes
    .filter((n) => n.type === 'place')
    .sort((a, b) => a.data.label.localeCompare(b.data.label, undefined, { numeric: true }));
  const transitions = nodes
    .filter((n) => n.type === 'transition')
    .sort((a, b) => a.data.label.localeCompare(b.data.label, undefined, { numeric: true }));

  const placeLabels = places.map((p) => p.data.label);
  const transLabels = transitions.map((t) => t.data.label);

  const PRE = places.map(() => transitions.map(() => 0));
  const POST = places.map(() => transitions.map(() => 0));

  edges.forEach((edge) => {
    const src = nodes.find((n) => n.id === edge.source);
    const tgt = nodes.find((n) => n.id === edge.target);
    if (!src || !tgt) return;
    const weight = edge.data?.weight || 1;

    if (src.type === 'place' && tgt.type === 'transition') {
      const pi = placeLabels.indexOf(src.data.label);
      const tj = transLabels.indexOf(tgt.data.label);
      if (pi >= 0 && tj >= 0) PRE[pi][tj] = weight;
    }
    if (src.type === 'transition' && tgt.type === 'place') {
      const pi = placeLabels.indexOf(tgt.data.label);
      const tj = transLabels.indexOf(src.data.label);
      if (pi >= 0 && tj >= 0) POST[pi][tj] = weight;
    }
  });

  const W = PRE.map((row, i) =>
    row.map((val, j) => POST[i][j] - val)
  );

  return { places, transitions, placeLabels, transLabels, PRE, POST, W };
}

function computeMarkingEvolution(nodes, edges, markingSequence) {
  if (markingSequence.length < 2) return [];

  const { transLabels, W } = computeMatrices(nodes, edges);
  const result = [];

  for (let k = 0; k < markingSequence.length - 1; k++) {
    const current = markingSequence[k];
    const next = markingSequence[k + 1];
    const transition = next.transition;

    const tj = transLabels.indexOf(transition);
    const Ik = transLabels.map((_, j) => (j === tj ? 1 : 0));

    const Mk = current.marking.map((m) => m.marking);
    const delta = W.map((row) =>
      row.reduce((sum, w, j) => sum + w * Ik[j], 0)
    );
    const Mk1 = Mk.map((v, i) => v + delta[i]);

    result.push({
      step: k,
      transition,
      Mk,
      Ik,
      delta,
      Mk1,
    });
  }

  return result;
}

function MatrixTable({ labels, matrix, type }) {
  return (
    <div className="matrix-wrapper">
      <table className="matrix-table">
        <thead>
          <tr>
            <th className="matrix-corner">{type}</th>
            {labels.trans.map((t) => (
              <th key={t} className="matrix-col-header">{t}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrix.map((row, i) => (
            <tr key={i}>
              <td className="matrix-row-header">{labels.places[i]}</td>
              {row.map((val, j) => (
                <td
                  key={j}
                  className={`matrix-cell ${val > 0 ? 'positive' : val < 0 ? 'negative' : 'zero'}`}
                >
                  {val}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CalculationPanel() {
  const nodes = usePetriStore((s) => s.nodes);
  const edges = usePetriStore((s) => s.edges);
  const markingSequence = usePetriStore((s) => s.markingSequence);

  const { placeLabels, transLabels, PRE, POST, W } = computeMatrices(nodes, edges);
  const evolution = computeMarkingEvolution(nodes, edges, markingSequence);

  const hasData = placeLabels.length > 0 && transLabels.length > 0;

  if (!hasData) {
    return (
      <div className="calc-panel">
        <div className="calc-header">
          <h2>Calculs</h2>
          <p className="calc-subtitle">Matrices et evolution</p>
        </div>
        <div className="calc-empty">
          <p>Aucun reseau defini.</p>
          <p className="help-text">Ajoutez des places, transitions et arcs.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="calc-panel">
      <div className="calc-header">
        <h2>Calculs</h2>
        <p className="calc-subtitle">
          {placeLabels.length}P x {transLabels.length}T
        </p>
      </div>

      <div className="calc-section">
        <h3>Matrice PRE (entrees)</h3>
        <p className="calc-desc">PRE[i,j] = poids de l'arc Place i → Transition j</p>
        <MatrixTable labels={{ places: placeLabels, trans: transLabels }} matrix={PRE} type="PRE" />
      </div>

      <div className="calc-section">
        <h3>Matrice POST (sorties)</h3>
        <p className="calc-desc">POST[i,j] = poids de l'arc Transition j → Place i</p>
        <MatrixTable labels={{ places: placeLabels, trans: transLabels }} matrix={POST} type="POST" />
      </div>

      <div className="calc-section">
        <h3>Matrice W = POST − PRE</h3>
        <p className="calc-desc">Matrice d'incidence fondamentale</p>
        <MatrixTable labels={{ places: placeLabels, trans: transLabels }} matrix={W} type="W" />
      </div>

      {evolution.length > 0 && (
        <div className="calc-section">
          <h3>Evolution des marquages</h3>
          <p className="calc-desc">M(k+1) = M(k) + W × I(k)</p>
          <div className="evolution-list">
            {evolution.map((e, idx) => (
              <div key={idx} className="evolution-entry">
                <div className="evo-header">
                  <span className="evo-step">k={e.step}</span>
                  <span className="evo-arrow">→</span>
                  <span className="evo-step">k={e.step + 1}</span>
                  <span className="evo-transition">via {e.transition}</span>
                </div>
                <div className="evo-formula">
                  <span className="evo-label">M({e.step})</span>
                  <span className="evo-matrix">= ({e.Mk.join(', ')})</span>
                </div>
                <div className="evo-formula">
                  <span className="evo-label">I({e.step})</span>
                  <span className="evo-matrix">= ({e.Ik.join(', ')})</span>
                </div>
                <div className="evo-formula">
                  <span className="evo-label">Δ</span>
                  <span className="evo-matrix">= W×I = ({e.delta.join(', ')})</span>
                </div>
                <div className="evo-formula evo-result">
                  <span className="evo-label">M({e.step + 1})</span>
                  <span className="evo-matrix">= ({e.Mk.join(', ')}) + ({e.delta.join(', ')}) = <strong>({e.Mk1.join(', ')})</strong></span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default CalculationPanel;
