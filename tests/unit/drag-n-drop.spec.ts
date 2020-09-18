import { mount } from '@vue/test-utils';
import Draggable, { MoveEvent } from 'vuedraggable';
import QueryBuilder from '@/QueryBuilder.vue';
import QueryBuilderGroup from '@/QueryBuilderGroup.vue';
import {
  RuleSet, Rule, QueryBuilderConfig, QueryBuilderGroup as QueryBuilderGroupInterface,
} from '@/types';
import Component from '../components/Component.vue';

// Schedule a microtask, so all pending promises can be executed
const flushPromises = (): Promise<void> => new Promise(res => setTimeout(res, 0));

describe('Test drag\'n\'drop related actions', () => {
  const value: RuleSet = {
    operatorIdentifier: 'OR',
    children: [{
      operatorIdentifier: 'AND',
      children: [{
        identifier: 'txt',
        value: 'A',
      }, {
        identifier: 'txt',
        value: 'B',
      }, {
        identifier: 'txt',
        value: 'C',
      }, {
        operatorIdentifier: 'AND',
        children: [{
          identifier: 'txt',
          value: 'D',
        }, {
          identifier: 'txt',
          value: 'E',
        }, {
          operatorIdentifier: 'AND',
          children: [{
            identifier: 'txt',
            value: 'F',
          }, {
            operatorIdentifier: 'AND',
            children: [{
              identifier: 'txt',
              value: 'G',
            }],
          }, {
            identifier: 'txt',
            value: 'H',
          }],
        }],
      }],
    }, {
      operatorIdentifier: 'AND',
      children: [{
        identifier: 'txt',
        value: 'X',
      }, {
        operatorIdentifier: 'AND',
        children: [{
          identifier: 'txt',
          value: 'T',
        }],
      }, {
        identifier: 'txt',
        value: 'Y',
      }, {
        identifier: 'txt',
        value: 'Z',
      }],
    }],
  };

  const config: QueryBuilderConfig = {
    operators: [
      {
        name: 'AND',
        identifier: 'AND',
      },
      {
        name: 'OR',
        identifier: 'OR',
      },
    ],
    rules: [
      {
        identifier: 'txt',
        name: 'Text Selection',
        component: Component,
        initialValue: '',
      },
      {
        identifier: 'num',
        name: 'Number Selection',
        component: Component,
        initialValue: 10,
      },
    ],
    dragging: {
      animation: 300,
      disabled: false,
      ghostClass: 'ghost',
    },
  };

  it('ensures missing drag\'n\'drop configuration does not break the component', () => {
    const newConfig: QueryBuilderConfig = {
      operators: config.operators,
      rules: config.rules,
    };

    mount(QueryBuilder, {
      propsData: {
        value,
        config: newConfig,
      },
    });
  });

  it('tests drag\'n\'dropping within the same group', () => {
    const app = mount(QueryBuilder, {
      propsData: {
        value,
        config,
      },
    });

    const qbClone: RuleSet = JSON.parse(JSON.stringify(value));
    const { children } = (qbClone.children[0] as RuleSet).children[3] as RuleSet;
    children.splice(2, 0, children.splice(0, 1)[0]);
    ((qbClone.children[0] as RuleSet).children[3] as RuleSet).children = children;

    const group = app.findAll(QueryBuilderGroup)
      .filter(qb => {
        const vm = qb.vm as QueryBuilderGroupInterface;

        return vm.selectedOperator === 'AND'
          && vm.children.length === 3
          && (vm.children[0] as Rule).value === 'D';
      })
      .at(0);

    const mvEv: MoveEvent<RuleSet | Rule> = {
      moved: {
        element: (group.vm as QueryBuilderGroupInterface).children[0],
        oldIndex: 0,
        newIndex: 2,
      },
    };
    group.find(Draggable).vm.$emit('change', mvEv);
    expect(group.emitted()['query-update'][0][0]).toStrictEqual({ operatorIdentifier: 'AND', children });
    expect(app.emitted().input[0][0]).toStrictEqual(qbClone);
  });

  it('tests drag\'n\'drop by merging with a parent group', async done => {
    const app = mount(QueryBuilder, {
      propsData: {
        value,
        config,
      },
    });

    const qbClone: RuleSet = JSON.parse(JSON.stringify(value));
    const remover = qbClone.children[0] as RuleSet;
    const adder = qbClone.children[1] as RuleSet;
    const element = remover.children.splice(1, 1)[0] as Rule; // Moving element
    adder.children.splice(3, 0, element);

    // Component we'd need to assert against
    const parent = app.find(QueryBuilderGroup);

    // Removing branch
    const removerComponent = app.findAll(QueryBuilderGroup)
      .filter(qb => {
        const vm = qb.vm as QueryBuilderGroupInterface;

        return vm.selectedOperator === 'AND'
          && vm.children.length === 4
          && (vm.children[0] as Rule).value === 'A';
      })
      .at(0);
    const rmEv: MoveEvent<RuleSet | Rule> = {
      removed: {
        element,
        oldIndex: 1,
      },
    };
    removerComponent.find(Draggable).vm.$emit('change', rmEv);

    // Adding branch
    const adderComponent = app.findAll(QueryBuilderGroup)
      .filter(qb => {
        const vm = qb.vm as QueryBuilderGroupInterface;

        return vm.selectedOperator === 'AND'
          && vm.children.length === 4
          && (vm.children[0] as Rule).value === 'X';
      })
      .at(0);
    const addEv: MoveEvent<RuleSet | Rule> = {
      added: {
        element,
        newIndex: 3,
      },
    };
    adderComponent.find(Draggable).vm.$emit('change', addEv);

    await flushPromises();

    expect(parent.emitted()['query-update'][0][0]).toStrictEqual(qbClone);
    expect(app.emitted().input[0][0]).toStrictEqual(qbClone);

    done();
  });

  it('tests drag\'n\'dropping with merging within the adding group', async done => {
    const app = mount(QueryBuilder, {
      propsData: {
        value,
        config,
      },
    });

    // Move 'D' to parent group after 'C'
    const qbClone: RuleSet = JSON.parse(JSON.stringify(value));
    const adder = qbClone.children[0] as RuleSet;
    const remover = adder.children[3] as RuleSet;
    const element = remover.children.splice(0, 1)[0] as Rule; // Moving element
    adder.children.splice(3, 0, element);

    // Removing branch
    const removerComponent = app.findAll(QueryBuilderGroup)
      .filter(qb => {
        const vm = qb.vm as QueryBuilderGroupInterface;

        return vm.selectedOperator === 'AND'
          && vm.children.length === 3
          && (vm.children[0] as Rule).value === 'D';
      })
      .at(0);
    const rmEv: MoveEvent<RuleSet | Rule> = {
      removed: {
        element,
        oldIndex: 0,
      },
    };
    removerComponent.find(Draggable).vm.$emit('change', rmEv);

    // Adding branch
    const adderComponent = app.findAll(QueryBuilderGroup)
      .filter(qb => {
        const vm = qb.vm as QueryBuilderGroupInterface;

        return vm.selectedOperator === 'AND'
          && vm.children.length === 4
          && (vm.children[0] as Rule).value === 'A';
      })
      .at(0);
    const addEv: MoveEvent<RuleSet | Rule> = {
      added: {
        element,
        newIndex: 3,
      },
    };
    adderComponent.find(Draggable).vm.$emit('change', addEv);

    await flushPromises();

    expect(adderComponent.emitted()['query-update'][0][0]).toStrictEqual(adder);
    expect(app.emitted().input[0][0]).toStrictEqual(qbClone);

    done();
  });

  it('tests drag\'n\'dropping with merging within the deleting group', async done => {
    const app = mount(QueryBuilder, {
      propsData: {
        value,
        config,
      },
    });

    // Move 'A' to child group between 'D' and 'E'
    const qbClone: RuleSet = JSON.parse(JSON.stringify(value));
    const remover = qbClone.children[0] as RuleSet;
    const adder = remover.children[3] as RuleSet;
    const element = remover.children.splice(0, 1)[0] as Rule; // Moving element
    adder.children.splice(1, 0, element);

    // Removing branch
    const removerComponent = app.findAll(QueryBuilderGroup)
      .filter(qb => {
        const vm = qb.vm as QueryBuilderGroupInterface;

        return vm.selectedOperator === 'AND'
          && vm.children.length === 4
          && (vm.children[0] as Rule).value === 'A';
      })
      .at(0);
    const rmEv: MoveEvent<RuleSet | Rule> = {
      removed: {
        element,
        oldIndex: 0,
      },
    };
    removerComponent.find(Draggable).vm.$emit('change', rmEv);

    // Adding branch
    const adderComponent = app.findAll(QueryBuilderGroup)
      .filter(qb => {
        const vm = qb.vm as QueryBuilderGroupInterface;

        return vm.selectedOperator === 'AND'
          && vm.children.length === 3
          && (vm.children[0] as Rule).value === 'D';
      })
      .at(0);
    const addEv: MoveEvent<RuleSet | Rule> = {
      added: {
        element,
        newIndex: 1,
      },
    };
    adderComponent.find(Draggable).vm.$emit('change', addEv);

    await flushPromises();

    expect(removerComponent.emitted()['query-update'][0][0]).toStrictEqual(remover);
    expect(app.emitted().input[0][0]).toStrictEqual(qbClone);

    done();
  });
});
