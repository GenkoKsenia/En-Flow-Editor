import type { DiagramContext } from './diagram.context'
import { createDiagramCountersUseCases } from './diagram-counters.use-case'
import { createDiagramDataFlowsUseCases } from './diagram-data-flows.use-case'
import { createDiagramEdgesUseCases } from './diagram-edges.use-case'
import { createDiagramNodesUseCases } from './diagram-nodes.use-case'
import { createDiagramParentingUseCases } from './diagram-parenting.use-case'

export function createDiagramLocalUseCases(context: DiagramContext) {
  const countersUseCases = createDiagramCountersUseCases(context)
  const dataFlowUseCases = createDiagramDataFlowsUseCases(context)
  const parentingUseCases = createDiagramParentingUseCases(context)
  const nodesUseCases = createDiagramNodesUseCases(context, {
    ensureFlowsForInformation: dataFlowUseCases.ensureFlowsForInformation,
  })
  const edgesUseCases = createDiagramEdgesUseCases(context, {
    buildNodeSendableData: dataFlowUseCases.buildNodeSendableData,
  })

  return {
    ...countersUseCases,
    ...dataFlowUseCases,
    ...parentingUseCases,
    ...nodesUseCases,
    ...edgesUseCases,
  }
}
