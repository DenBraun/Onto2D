"""Read-only source accounting and finite mathematical witnesses for the review.

This checks a research proposal, not Model Pack conformance or physical truth.
No PDF extraction dependency, network request, source edit or solver run is used.
"""

import hashlib
import itertools
import json
import math
from pathlib import Path
import sys
import zipfile

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]


def require(condition, message):
    if not condition:
        raise ValueError(message)


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        require(key not in result, f"Duplicate JSON key: {key}")
        result[key] = value
    return result


def read_json(path):
    return json.loads(path.read_text(), object_pairs_hook=unique_object)


def verify_identity(record):
    path = (ROOT / record['path']).resolve()
    require(path.is_relative_to(ROOT), 'Source path escapes repository')
    body = path.read_bytes()
    require(len(body) == record['bytes'], f"Byte count changed: {record['path']}")
    require(hashlib.sha256(body).hexdigest() == record['sha256'],
            f"Source changed: {record['path']}; review before rebinding")


def mathematical_witnesses():
    # PDF p13, (24)-(26): (-dtt+dxx+m2) exp(i(kx-omega t)).
    k, omega, m2 = 1, 2, 3
    paper_residual = omega**2 - k**2 + m2
    case_residual = -omega**2 + k**2 + m2
    require(m2 == omega**2-k**2 and paper_residual == 6 and case_residual == 0,
            'Operator-sign witness failed')

    # Independently integrate the derivative and mass contributions for real
    # sinusoidal variations on [0,2pi]^2. The first variation at zero vanishes;
    # the quadratic variation has both signs even for positive m2=3.
    samples = [2*math.pi*i/512 for i in range(512)]
    def action_coefficient(time_frequency, space_frequency):
        frequency = time_frequency or space_frequency
        mean_derivative_square = sum((frequency*math.cos(frequency*z))**2 for z in samples)/len(samples)
        mean_field_square = sum(math.sin(frequency*z)**2 for z in samples)/len(samples)
        derivative_sign = -1 if time_frequency else 1
        return 2*(derivative_sign*mean_derivative_square - m2*mean_field_square)

    action_variations = {'temporal': action_coefficient(1,0), 'spatial': action_coefficient(0,2)}
    require(math.isclose(action_variations['temporal'],-4,abs_tol=1e-12)
            and math.isclose(action_variations['spatial'],1,abs_tol=1e-12), 'Action integration failed')
    require(min(action_variations.values()) < 0 < max(action_variations.values()),
            'Stationarity/minimum witness failed')

    # Three distinct spatial Fourier modes, all amplitudes one.
    # At every fixed t, orthogonality gives integral_0^(2pi)|Psi|^2=6pi.
    # This is a witness against sufficiency of balance alone, not a solution
    # of the paper's unspecified nonlinear coupled system.
    wave_numbers = (1, 2, -3)
    frequencies = (2, 3, -5)
    require(sum(wave_numbers) == sum(frequencies) == 0, 'Resonance witness failed')
    require(len(set(wave_numbers)) == 3, 'Fourier modes must be distinct')
    full_norm_in_units_2pi = sum(1 for _ in wave_numbers)
    removed_norms_in_units_2pi = [sum(1 for j in range(3) if j != i) for i in range(3)]
    require(full_norm_in_units_2pi == 3 and removed_norms_in_units_2pi == [2,2,2],
            'Density/removal witness failed')
    # Check the analytic orthogonality result against direct complex samples
    # at several times, with all three single-mode removals.
    for t in (0,0.7,2.1):
        for excluded in (None,0,1,2):
            square_values = []
            for x in samples:
                value = sum(complex(math.cos(k*x-w*t),math.sin(k*x-w*t))
                            for i,(k,w) in enumerate(zip(wave_numbers,frequencies)) if i != excluded)
                square_values.append(abs(value)**2)
            expected = 3 if excluded is None else 2
            require(math.isclose(sum(square_values)/len(samples),expected,abs_tol=1e-12),
                    'Direct density quadrature differs from Fourier calculation')

    # Cardinality minimality is conditional on the chosen graph class.
    cycle_minimum = None
    examined = 0
    for n in range(1, 4):
        pairs = list(itertools.combinations(range(n), 2))
        for mask in range(1 << len(pairs)):
            parent = list(range(n))

            def find(v):
                while parent[v] != v:
                    v = parent[v]
                return v

            has_cycle = False
            for index, (a,b) in enumerate(pairs):
                if mask & (1 << index):
                    left, right = find(a), find(b)
                    if left == right:
                        has_cycle = True
                    else:
                        parent[left] = right
            examined += 1
            if has_cycle and cycle_minimum is None:
                cycle_minimum = n
    require(cycle_minimum == 3 and examined == 11, 'Simple-cycle census failed')

    # Effective dynamics need a sufficient state map. This deliberately small
    # example illustrates the obligation; it is not a CRT/emergence experiment.
    states = list(itertools.product((0,1), repeat=2))
    transition = lambda x: (x[1], x[1])
    good_map = lambda x: x[1]
    bad_map = lambda x: x[0]
    # Find *all* maps {0,1}->{0,1}, rather than assuming the proposed macro law.
    def compatible_macro_laws(q):
        return [list(values) for values in itertools.product((0,1), repeat=2)
                if all(q(transition(x)) == values[q(x)] for x in states)]

    good_laws = compatible_macro_laws(good_map)
    bad_laws = compatible_macro_laws(bad_map)
    require(good_laws == [[0,1]] and bad_laws == [], 'Effective-description check failed')
    # Explicit failing pair for q_bad; it has identical macro input but different outputs.
    x, y = (0,0), (0,1)
    require(bad_map(x) == bad_map(y) and bad_map(transition(x)) != bad_map(transition(y)),
            'Insufficient-state-map witness failed')

    return {
        'operatorSign': {'k':k, 'omega':omega, 'm2':m2,
                         'paperResidualCoefficient':paper_residual,
                         'caseResidualCoefficient':case_residual},
        'stationarityIsNotMinimum': {'actionVariationUnits':'pi^2 epsilon^2',
                                    'm2':m2, 'coefficients':{key:round(value,12) for key,value in action_variations.items()}},
        'balanceDoesNotLocalize': {'k':wave_numbers, 'omega':frequencies,
                                  'period':'2pi', 'normPerPeriodInUnits2pi':full_norm_in_units_2pi,
                                  'normAfterEachRemovalInUnits2pi':removed_norms_in_units_2pi,
                                  'infiniteLineNorm':'diverges; periodic nonzero mean density'},
        'simpleGraphMinimality': {'graphsExamined':examined, 'smallestCycleVertexCount':cycle_minimum,
                                 'scope':'undirected simple graphs on 1..3 labelled vertices'},
        'effectiveDescription': {'microStates':4, 'macroFunctionsTriedPerMap':4,
                                'microUpdate':'(a,b) -> (b,b)',
                                'goodMap':'q(a,b)=b', 'goodMacroLaws':good_laws,
                                'badMap':'q(a,b)=a', 'badMacroLaws':bad_laws,
                                'failurePair':[x,y],
                                'scope':'finite deterministic illustration; no intervention or physical claim'}
    }


def run():
    inventory = read_json(HERE/'source-review.json')
    proposal = read_json(HERE/'level-0-proposal.json')
    require(proposal['status'] == 'reviewable-proposal-not-active-model-pack', 'Wrong proposal status')
    identities = [inventory['archive'], *inventory['papers'], proposal['source'], *proposal['caseEvidence']]
    for record in identities:
        verify_identity(record)
    with zipfile.ZipFile(ROOT/inventory['archive']['path']) as archive:
        require(len(archive.infolist()) == inventory['archive']['entries'], 'Archive entry count changed')
        actual_members = [i.filename for i in archive.infolist() if not i.is_dir()]
        reviewed_members = inventory['archive']['textMembers']
        require(sorted(actual_members) == sorted(i['member'] for i in reviewed_members), 'Archive coverage differs')
        require(len(set(actual_members)) == len(actual_members), 'Duplicate ZIP member name')
        for record in reviewed_members:
            body = archive.read(record['member'])
            require(hashlib.sha256(body).hexdigest() == record['sha256'], 'Archive member hash changed')
            require(len(body) == record['bytes'], 'Archive member byte count changed')
            line_count = len(body.decode('utf-8-sig').splitlines())
            require(record['reviewedLines'] == [1,line_count] and record['lineCount'] == line_count,
                    'Archive review range does not cover member')

    source = read_json(ROOT/proposal['source']['path'])
    require(len(source) == 24, 'This proposal covers the historical 24-record Level 0')
    source_nodes = {f"{n['Level']}.{n['Id']}": (i,n) for i,n in enumerate(source)}
    mappings = proposal['legacyNodeMappings']
    require(len(mappings) == len(source_nodes) and {m['legacyCode'] for m in mappings} == set(source_nodes),
            'Legacy node coverage differs')
    entity_ids = [e['id'] for e in proposal['entities']]
    require(len(entity_ids) == len(set(entity_ids)), 'Duplicate proposed entity ID')
    for mapping in mappings:
        i, node = source_nodes[mapping['legacyCode']]
        require(mapping['jsonPointer'] == f'/{i}' and mapping['legacyName'] == node['Name']
                and mapping['cataloguePhase'] == node['Phase'], 'Incorrect source node locator/identity')
        require(mapping['proposedEntityIds'] and set(mapping['proposedEntityIds']) <= set(entity_ids),
                'Unresolved proposed entity mapping')
    expected_relations = [(f"{p['ParentCode']}->0.{n['Id']}", f'/{i}/Parents/{j}')
                          for i,n in enumerate(source) for j,p in enumerate(n['Parents'])]
    actual_relations = [(e['id'],e['jsonPointer']) for e in proposal['legacyRelationInventory']]
    require(actual_relations == expected_relations and len(actual_relations) == 84, 'Legacy edge coverage differs')
    require(all(e['id'] == f"{e['parentCode']}->{e['childCode']}" for e in proposal['legacyRelationInventory']),
            'Incorrect relation endpoint fields')
    claims = proposal['claims']
    claim_ids = {c['id'] for c in claims}
    require(len(claim_ids) == len(claims), 'Duplicate claim ID')
    require(all(set(c['entityIds']) <= set(entity_ids) for c in claims), 'Unresolved claim target')
    require(all(c['source'] == 'topology' and all(1 <= p <= 36 for p in c['pages']) for c in claims),
            'Invalid paper locator')
    rules = proposal['constructionRules']
    require(len({r['id'] for r in rules}) == len(rules), 'Duplicate construction rule ID')
    for rule in rules:
        require(set(rule['inputEntityIds']+rule['outputEntityIds']) <= set(entity_ids), 'Unresolved rule entity')
        require(set(rule['sourceClaims']) <= claim_ids and rule['conditions'], 'Unresolved or empty rule')

    result = {'status':'proposal-accounting-and-mathematical-witnesses-checked',
              'filesBound':len(identities), 'archiveTextMembers':len(reviewed_members),
              'legacyNodes':len(mappings), 'legacyRelations':len(actual_relations),
              'proposedEntities':len(entity_ids), 'claims':len(claims), 'rules':len(rules),
              'mathematicalWitnesses':mathematical_witnesses(),
              'limits':'No physical validation, full PDF proof verification, exhaustive relation review or solver replay is claimed.'}
    print(json.dumps(result,ensure_ascii=False,indent=2))


if __name__ == '__main__':
    try:
        run()
    except (ValueError, OSError, KeyError, zipfile.BadZipFile) as error:
        print(f'Reconstruction review check failed: {error}', file=sys.stderr)
        sys.exit(1)
