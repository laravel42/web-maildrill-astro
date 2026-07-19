import { TEditorConfiguration } from '../../documents/editor/core';

const ORDER_ECOMMERCE: TEditorConfiguration = {
  root: {
    type: 'EmailLayout',
    data: {
      backdropColor: '#FFFFFF',
      canvasColor: '#FFFFFF',
      textColor: '#333333',
      fontFamily: 'MODERN_SANS',
      childrenIds: [
        'block_Ei34o65X5XnD5dexNQgXh8',
        'block_SLut2hpFsy7U6SmhtLtWNU',
        'block_RrwLc5YMpHJGE5Xe9fAZVW',
        'block_FHCeHrN3XNaH7bu6HhjVNT',
        'block_3vynUg15EevMA6DiLsWJk2',
        'block_5eQPGdKJ6JQYXCD1MEaHbv',
        'block_WK3b19BzGE8VNKDwiSZ8s8',
        'block_Pe2Dm5Cbqq5CcjL5wEdMg4',
        'block_SizNWJDCcqw9tGH2ComdDX',
        'block_4Qxv32WQo8pDzPu1d3vixz',
        'block_LKiZYDTPeJGkRWHForFSDQ',
        'block_P6XtJj721vPfrhXKzS8uR5',
        'block_AKTwpjBmtevcfj82z52i8p',
      ],
    },
  },
  block_PHe2XSbV4RvD76p21F3VdN: {
    type: 'NotionText',
    data: {
      style: {
        color: null,
        backgroundColor: null,
        fontFamily: null,
        fontWeight: 'normal',
        textAlign: 'left',
        padding: {
          top: 0,
          bottom: 0,
          left: 0,
          right: 0,
        },
      },
      props: {
        html: '<h2>Unbranded Supply</h2>',
      },
    },
  },
  block_DeTzPQDerYjBEMkt6TuD41: {
    type: 'Container',
    data: {
      style: {
        backgroundColor: null,
        borderColor: null,
        borderRadius: null,
        padding: {
          top: 0,
          bottom: 0,
          left: 0,
          right: 0,
        },
      },
      props: {
        childrenIds: ['block_PHe2XSbV4RvD76p21F3VdN'],
      },
    },
  },
  block_TPxZn2Fjxc7MwgXAEybxkV: {
    type: 'NotionText',
    data: {
      style: {
        color: '#808080',
        backgroundColor: null,
        fontSize: 14,
        fontFamily: null,
        fontWeight: 'normal',
        textAlign: 'right',
        padding: {
          top: 0,
          bottom: 0,
          left: 0,
          right: 0,
        },
      },
      props: {
        html: '<p>#103571871</p>',
      },
    },
  },
  block_5fuNN9F4uZRTGa4Hy5F4Nd: {
    type: 'Container',
    data: {
      style: {
        backgroundColor: null,
        borderColor: null,
        borderRadius: null,
        padding: {
          top: 0,
          bottom: 0,
          left: 0,
          right: 0,
        },
      },
      props: {
        childrenIds: ['block_TPxZn2Fjxc7MwgXAEybxkV'],
      },
    },
  },
  block_Ei34o65X5XnD5dexNQgXh8: {
    type: 'ColumnsContainer',
    data: {
      style: {
        backgroundColor: null,
        padding: {
          top: 16,
          bottom: 24,
          left: 24,
          right: 24,
        },
      },
      props: {
        columnsCount: 2,
        columns: [
          {
            childrenIds: ['block_DeTzPQDerYjBEMkt6TuD41'],
          },
          {
            childrenIds: ['block_5fuNN9F4uZRTGa4Hy5F4Nd'],
          },
          {
            childrenIds: [],
          },
        ],
      },
    },
  },
  block_SLut2hpFsy7U6SmhtLtWNU: {
    type: 'NotionText',
    data: {
      style: {
        color: null,
        backgroundColor: null,
        fontFamily: null,
        fontWeight: 'normal',
        textAlign: 'left',
        padding: {
          top: 16,
          bottom: 0,
          left: 24,
          right: 24,
        },
      },
      props: {
        html: '<h3>Thank you for your purchase!</h3>',
      },
    },
  },
  block_RrwLc5YMpHJGE5Xe9fAZVW: {
    type: 'NotionText',
    data: {
      style: {
        color: '#404040',
        backgroundColor: null,
        fontSize: 16,
        fontFamily: null,
        fontWeight: 'normal',
        textAlign: 'left',
        padding: {
          top: 16,
          bottom: 16,
          left: 24,
          right: 24,
        },
      },
      props: {
        html: '<p>Hi Jordan,<br /><br />We are preparing your package. Your tracking number will be generated once the package is ready to ship.</p>',
      },
    },
  },
  block_FHCeHrN3XNaH7bu6HhjVNT: {
    type: 'Button',
    data: {
      style: {
        backgroundColor: null,
        fontSize: 16,
        fontFamily: null,
        fontWeight: 'normal',
        textAlign: 'left',
        shape: 'pill',
        padding: {
          top: 16,
          bottom: 40,
          left: 24,
          right: 24,
        },
      },
      props: {
        buttonBackgroundColor: '#5696E5',
        buttonTextColor: '#FFFFFF',
        fullWidth: false,
        size: 'medium',
        text: 'View your order',
        url: 'https://example.usewaypoint.com/orders/103571871',
      },
    },
  },
  block_3vynUg15EevMA6DiLsWJk2: {
    type: 'NotionText',
    data: {
      style: {
        color: null,
        backgroundColor: null,
        fontFamily: null,
        fontWeight: 'normal',
        textAlign: 'left',
        padding: {
          top: 16,
          bottom: 0,
          left: 24,
          right: 24,
        },
      },
      props: {
        html: '<h3>Order summary</h3>',
      },
    },
  },
  block_Dvs2GYcF6SzfCYYNwfv1oM: {
    type: 'Image',
    data: {
      style: {
        backgroundColor: null,
        padding: {
          top: 0,
          bottom: 0,
          left: 0,
          right: 0,
        },
        textAlign: 'left',
      },
      props: {
        url: 'https://d1iiu589g39o6c.cloudfront.net/live/platforms/platform_A9wwKSL6EV6orh6f/images/wptemplateimage_FBfTeYhbdXtqYpCA/kiran-ck-6rXpQzfCYlw-unsplash.jpg',
        alt: '',
        linkHref: null,
        contentAlignment: 'middle',
      },
    },
  },
  block_KnMb2mQSf7nz8HXx6jyDUV: {
    type: 'Container',
    data: {
      style: {
        backgroundColor: null,
        borderColor: null,
        borderRadius: null,
        padding: {
          top: 0,
          bottom: 0,
          left: 0,
          right: 0,
        },
      },
      props: {
        childrenIds: ['block_Dvs2GYcF6SzfCYYNwfv1oM'],
      },
    },
  },
  block_4sAeV4cLVKV8y4QFGV3Gf7: {
    type: 'Container',
    data: {
      style: {
        backgroundColor: null,
        borderColor: null,
        borderRadius: null,
        padding: {
          top: 4,
          bottom: 4,
          left: 4,
          right: 4,
        },
      },
      props: {
        childrenIds: ['block_KnMb2mQSf7nz8HXx6jyDUV'],
      },
    },
  },
  block_TBZZDHvoKHcW3j2nwQgmhC: {
    type: 'NotionText',
    data: {
      style: {
        color: null,
        backgroundColor: null,
        fontSize: 16,
        fontFamily: null,
        fontWeight: 'bold',
        textAlign: 'left',
        padding: {
          top: 0,
          bottom: 4,
          left: 0,
          right: 0,
        },
      },
      props: {
        html: '<p>Unbranded Pen x 5</p>',
      },
    },
  },
  block_KqpmZUcZajsnFMbTMhizZs: {
    type: 'NotionText',
    data: {
      style: {
        color: '#808080',
        backgroundColor: null,
        fontSize: 14,
        fontFamily: null,
        fontWeight: 'normal',
        textAlign: 'left',
        padding: {
          top: 0,
          bottom: 0,
          left: 0,
          right: 0,
        },
      },
      props: {
        html: '<p>Black / Black ink</p>',
      },
    },
  },
  block_92JgagxxVxzyfnbvj5iUUJ: {
    type: 'Container',
    data: {
      style: {
        backgroundColor: null,
        borderColor: null,
        borderRadius: null,
        padding: {
          top: 0,
          bottom: 0,
          left: 0,
          right: 0,
        },
      },
      props: {
        childrenIds: [],
      },
    },
  },
  block_9bNBgfiJJyh65pfsy1fu7e: {
    type: 'NotionText',
    data: {
      style: {
        color: '#808080',
        backgroundColor: null,
        fontSize: 12,
        fontFamily: null,
        fontWeight: 'normal',
        textAlign: 'left',
        padding: {
          top: 0,
          bottom: 0,
          left: 0,
          right: 0,
        },
      },
      props: {
        html: '<p>($5.00)</p>',
      },
    },
  },
  block_7JwR5SHM2Bfjihamh45tRL: {
    type: 'Container',
    data: {
      style: {
        backgroundColor: null,
        borderColor: null,
        borderRadius: null,
        padding: {
          top: 0,
          bottom: 0,
          left: 0,
          right: 0,
        },
      },
      props: {
        childrenIds: [],
      },
    },
  },
  block_GQ77o7MDMwj48B5nocEJNq: {
    type: 'Container',
    data: {
      style: {
        backgroundColor: null,
        borderColor: null,
        borderRadius: null,
        padding: {
          top: 0,
          bottom: 0,
          left: 0,
          right: 0,
        },
      },
      props: {
        childrenIds: ['block_TBZZDHvoKHcW3j2nwQgmhC', 'block_KqpmZUcZajsnFMbTMhizZs'],
      },
    },
  },
  block_6VvTYskm3BULZZEfYCkjwN: {
    type: 'NotionText',
    data: {
      style: {
        color: null,
        backgroundColor: null,
        fontSize: 16,
        fontFamily: null,
        fontWeight: 'bold',
        textAlign: 'right',
        padding: {
          top: 0,
          bottom: 0,
          left: 0,
          right: 0,
        },
      },
      props: {
        html: '<p>$25.00</p>',
      },
    },
  },
  block_V34TMZ9yg6t4xKMYfyD2Rk: {
    type: 'Container',
    data: {
      style: {
        backgroundColor: null,
        borderColor: null,
        borderRadius: null,
        padding: {
          top: 0,
          bottom: 0,
          left: 0,
          right: 0,
        },
      },
      props: {
        childrenIds: ['block_6VvTYskm3BULZZEfYCkjwN'],
      },
    },
  },
  block_YBtUndjQaRuLFpEkgvjagk: {
    type: 'ColumnsContainer',
    data: {
      style: {
        backgroundColor: null,
        padding: {
          top: 0,
          bottom: 0,
          right: 0,
          left: 0,
        },
      },
      props: {
        fixedWidths: [64, null, 80],
        columnsCount: 3,
        columns: [
          {
            childrenIds: ['block_4sAeV4cLVKV8y4QFGV3Gf7'],
          },
          {
            childrenIds: ['block_GQ77o7MDMwj48B5nocEJNq'],
          },
          {
            childrenIds: ['block_V34TMZ9yg6t4xKMYfyD2Rk'],
          },
        ],
      },
    },
  },
  block_XykBAUxf8awiR2CxBfNLZN: {
    type: 'Container',
    data: {
      style: {
        backgroundColor: null,
        borderColor: null,
        borderRadius: null,
        padding: {
          top: 0,
          bottom: 0,
          left: 0,
          right: 0,
        },
      },
      props: {
        childrenIds: ['block_YBtUndjQaRuLFpEkgvjagk'],
      },
    },
  },
  block_9AvGGkcg4Rq93DmxXjXwEP: {
    type: 'Divider',
    data: {
      style: {
        backgroundColor: null,
        padding: {
          top: 8,
          bottom: 8,
          left: 0,
          right: 0,
        },
      },
      props: {
        lineHeight: 1,
        lineColor: '#EEEEEE',
      },
    },
  },
  block_5eQPGdKJ6JQYXCD1MEaHbv: {
    type: 'Container',
    data: {
      style: {
        backgroundColor: null,
        borderColor: null,
        borderRadius: null,
        padding: {
          top: 16,
          bottom: 16,
          left: 24,
          right: 24,
        },
      },
      props: {
        childrenIds: ['block_XykBAUxf8awiR2CxBfNLZN', 'block_9AvGGkcg4Rq93DmxXjXwEP'],
      },
    },
  },
  block_Wnt477QxYNynetWGwkLg89: {
    type: 'Container',
    data: {
      style: {
        backgroundColor: null,
        borderColor: null,
        borderRadius: null,
        padding: {
          top: 0,
          bottom: 0,
          left: 0,
          right: 0,
        },
      },
      props: {
        childrenIds: [],
      },
    },
  },
  block_FnzMxssTraByh9FbbnJvRw: {
    type: 'NotionText',
    data: {
      style: {
        color: '#808080',
        backgroundColor: null,
        fontSize: 16,
        fontFamily: null,
        fontWeight: 'normal',
        textAlign: 'left',
        padding: {
          top: 0,
          bottom: 0,
          left: 0,
          right: 0,
        },
      },
      props: {
        html: '<p>Discount (BLKFRI)</p>',
      },
    },
  },
  block_NyMsczQB7L3BKUa1RpUauu: {
    type: 'Container',
    data: {
      style: {
        backgroundColor: null,
        borderColor: null,
        borderRadius: null,
        padding: {
          top: 0,
          bottom: 0,
          left: 0,
          right: 0,
        },
      },
      props: {
        childrenIds: ['block_FnzMxssTraByh9FbbnJvRw'],
      },
    },
  },
  block_AcbYK2jnr4sqG1GAbUHqNL: {
    type: 'NotionText',
    data: {
      style: {
        color: null,
        backgroundColor: null,
        fontSize: 16,
        fontFamily: null,
        fontWeight: 'bold',
        textAlign: 'right',
        padding: {
          top: 0,
          bottom: 0,
          left: 0,
          right: 0,
        },
      },
      props: {
        html: '<p>$5.00</p>',
      },
    },
  },
  block_BgHgpkAxq2qJUttN8pimnE: {
    type: 'Container',
    data: {
      style: {
        backgroundColor: null,
        borderColor: null,
        borderRadius: null,
        padding: {
          top: 0,
          bottom: 0,
          left: 0,
          right: 0,
        },
      },
      props: {
        childrenIds: ['block_AcbYK2jnr4sqG1GAbUHqNL'],
      },
    },
  },
  block_2QEX1chf5uWU5ZZebf4gmu: {
    type: 'ColumnsContainer',
    data: {
      style: {
        backgroundColor: null,
        padding: {
          top: 4,
          bottom: 4,
          left: 0,
          right: 0,
        },
      },
      props: {
        columnsCount: 2,
        columns: [
          {
            childrenIds: ['block_NyMsczQB7L3BKUa1RpUauu'],
          },
          {
            childrenIds: ['block_BgHgpkAxq2qJUttN8pimnE'],
          },
          {
            childrenIds: [],
          },
        ],
      },
    },
  },
  block_Q87SYRrWCwfRa56q3qLBDG: {
    type: 'NotionText',
    data: {
      style: {
        color: '#808080',
        backgroundColor: null,
        fontSize: 16,
        fontFamily: null,
        fontWeight: 'normal',
        textAlign: 'left',
        padding: {
          top: 0,
          bottom: 0,
          left: 0,
          right: 0,
        },
      },
      props: {
        html: '<p>Subtotal</p>',
      },
    },
  },
  block_QUNbV1p7f9qaSEvyLmnxmD: {
    type: 'Container',
    data: {
      style: {
        backgroundColor: null,
        borderColor: null,
        borderRadius: null,
        padding: {
          top: 0,
          bottom: 0,
          left: 0,
          right: 0,
        },
      },
      props: {
        childrenIds: ['block_Q87SYRrWCwfRa56q3qLBDG'],
      },
    },
  },
  block_cF6MdfmbKisXytmfPU4QY: {
    type: 'NotionText',
    data: {
      style: {
        color: null,
        backgroundColor: null,
        fontSize: 16,
        fontFamily: null,
        fontWeight: 'bold',
        textAlign: 'right',
        padding: {
          top: 0,
          bottom: 0,
          left: 0,
          right: 0,
        },
      },
      props: {
        html: '<p>$25.00</p>',
      },
    },
  },
  block_4WkcuRqzqvTFvHGSBLGAAG: {
    type: 'Container',
    data: {
      style: {
        backgroundColor: null,
        borderColor: null,
        borderRadius: null,
        padding: {
          top: 0,
          bottom: 0,
          left: 0,
          right: 0,
        },
      },
      props: {
        childrenIds: ['block_cF6MdfmbKisXytmfPU4QY'],
      },
    },
  },
  block_Lu666sTP6hqLkHiBThmm4G: {
    type: 'ColumnsContainer',
    data: {
      style: {
        backgroundColor: null,
        padding: {
          top: 4,
          bottom: 4,
          left: 0,
          right: 0,
        },
      },
      props: {
        columnsCount: 2,
        columns: [
          {
            childrenIds: ['block_QUNbV1p7f9qaSEvyLmnxmD'],
          },
          {
            childrenIds: ['block_4WkcuRqzqvTFvHGSBLGAAG'],
          },
          {
            childrenIds: [],
          },
        ],
      },
    },
  },
  block_GgUZQtnTQbiBFhMdJE5YYB: {
    type: 'NotionText',
    data: {
      style: {
        color: '#808080',
        backgroundColor: null,
        fontSize: 16,
        fontFamily: null,
        fontWeight: 'normal',
        textAlign: 'left',
        padding: {
          top: 0,
          bottom: 0,
          left: 0,
          right: 0,
        },
      },
      props: {
        html: '<p>Shipping</p>',
      },
    },
  },
  block_XzjZ3cnqJrKrwubFwD4VSr: {
    type: 'Container',
    data: {
      style: {
        backgroundColor: null,
        borderColor: null,
        borderRadius: null,
        padding: {
          top: 0,
          bottom: 0,
          left: 0,
          right: 0,
        },
      },
      props: {
        childrenIds: ['block_GgUZQtnTQbiBFhMdJE5YYB'],
      },
    },
  },
  block_ViKMzYtjFGRksFuzRn5rny: {
    type: 'NotionText',
    data: {
      style: {
        color: null,
        backgroundColor: null,
        fontSize: 16,
        fontFamily: null,
        fontWeight: 'bold',
        textAlign: 'right',
        padding: {
          top: 0,
          bottom: 0,
          left: 0,
          right: 0,
        },
      },
      props: {
        html: '<p>$5.00</p>',
      },
    },
  },
  block_AcDrP2ZMVByFU269wvMgtw: {
    type: 'Container',
    data: {
      style: {
        backgroundColor: null,
        borderColor: null,
        borderRadius: null,
        padding: {
          top: 0,
          bottom: 0,
          left: 0,
          right: 0,
        },
      },
      props: {
        childrenIds: ['block_ViKMzYtjFGRksFuzRn5rny'],
      },
    },
  },
  block_Gn2h8bajFuW8zDBsiVVitV: {
    type: 'ColumnsContainer',
    data: {
      style: {
        backgroundColor: null,
        padding: {
          top: 4,
          bottom: 4,
          left: 0,
          right: 0,
        },
      },
      props: {
        columnsCount: 2,
        columns: [
          {
            childrenIds: ['block_XzjZ3cnqJrKrwubFwD4VSr'],
          },
          {
            childrenIds: ['block_AcDrP2ZMVByFU269wvMgtw'],
          },
          {
            childrenIds: [],
          },
        ],
      },
    },
  },
  block_64aQbVaGVuFmvjPfr9hend: {
    type: 'NotionText',
    data: {
      style: {
        color: '#808080',
        backgroundColor: null,
        fontSize: 16,
        fontFamily: null,
        fontWeight: 'normal',
        textAlign: 'left',
        padding: {
          top: 0,
          bottom: 0,
          left: 0,
          right: 0,
        },
      },
      props: {
        html: '<p>Taxes</p>',
      },
    },
  },
  block_QTKa4AdGxtSbJmRY7ytjD8: {
    type: 'Container',
    data: {
      style: {
        backgroundColor: null,
        borderColor: null,
        borderRadius: null,
        padding: {
          top: 0,
          bottom: 0,
          left: 0,
          right: 0,
        },
      },
      props: {
        childrenIds: ['block_64aQbVaGVuFmvjPfr9hend'],
      },
    },
  },
  block_H1MgkbcNH4sz8pMC2h4dVh: {
    type: 'NotionText',
    data: {
      style: {
        color: null,
        backgroundColor: null,
        fontSize: 16,
        fontFamily: null,
        fontWeight: 'bold',
        textAlign: 'right',
        padding: {
          top: 0,
          bottom: 0,
          left: 0,
          right: 0,
        },
      },
      props: {
        html: '<p>$0.00</p>',
      },
    },
  },
  block_Mi7A4sXfSXaEcjFV17WgSg: {
    type: 'Container',
    data: {
      style: {
        backgroundColor: null,
        borderColor: null,
        borderRadius: null,
        padding: {
          top: 0,
          bottom: 0,
          left: 0,
          right: 0,
        },
      },
      props: {
        childrenIds: ['block_H1MgkbcNH4sz8pMC2h4dVh'],
      },
    },
  },
  block_2xkeWLDtTXj5jFg57KhfYR: {
    type: 'ColumnsContainer',
    data: {
      style: {
        backgroundColor: null,
        padding: {
          top: 4,
          bottom: 4,
          left: 0,
          right: 0,
        },
      },
      props: {
        columnsCount: 2,
        columns: [
          {
            childrenIds: ['block_QTKa4AdGxtSbJmRY7ytjD8'],
          },
          {
            childrenIds: ['block_Mi7A4sXfSXaEcjFV17WgSg'],
          },
          {
            childrenIds: [],
          },
        ],
      },
    },
  },
  block_QgSNshqbsUkk4FrRywjoRd: {
    type: 'Divider',
    data: {
      style: {
        backgroundColor: null,
        padding: {
          top: 16,
          bottom: 16,
          left: 0,
          right: 0,
        },
      },
      props: {
        lineHeight: 1,
        lineColor: '#EEEEEE',
      },
    },
  },
  block_B5teSFiXFfpLmiB29c1WYF: {
    type: 'NotionText',
    data: {
      style: {
        color: '#808080',
        backgroundColor: null,
        fontSize: 16,
        fontFamily: null,
        fontWeight: 'normal',
        textAlign: 'left',
        padding: {
          top: 0,
          bottom: 0,
          left: 0,
          right: 0,
        },
      },
      props: {
        html: '<p>Total</p>',
      },
    },
  },
  block_DPodDUHaaLcYuAG3CQi1F7: {
    type: 'Container',
    data: {
      style: {
        backgroundColor: null,
        borderColor: null,
        borderRadius: null,
        padding: {
          top: 0,
          bottom: 0,
          left: 0,
          right: 0,
        },
      },
      props: {
        childrenIds: ['block_B5teSFiXFfpLmiB29c1WYF'],
      },
    },
  },
  block_Wo7gkfj5QDqEiXywi6e2dq: {
    type: 'NotionText',
    data: {
      style: {
        color: null,
        backgroundColor: null,
        fontSize: 21,
        fontFamily: null,
        fontWeight: 'bold',
        textAlign: 'right',
        padding: {
          top: 0,
          bottom: 0,
          left: 0,
          right: 0,
        },
      },
      props: {
        html: '<p>$30.00</p>',
      },
    },
  },
  block_YABuGb9jY34Rywk4H2wmhu: {
    type: 'Container',
    data: {
      style: {
        backgroundColor: null,
        borderColor: null,
        borderRadius: null,
        padding: {
          top: 0,
          bottom: 0,
          left: 0,
          right: 0,
        },
      },
      props: {
        childrenIds: ['block_Wo7gkfj5QDqEiXywi6e2dq'],
      },
    },
  },
  block_VvK99ZhLLgmycHQXKVFV7E: {
    type: 'ColumnsContainer',
    data: {
      style: {
        backgroundColor: null,
        padding: {
          top: 4,
          bottom: 4,
          left: 0,
          right: 0,
        },
      },
      props: {
        columnsCount: 2,
        columns: [
          {
            childrenIds: ['block_DPodDUHaaLcYuAG3CQi1F7'],
          },
          {
            childrenIds: ['block_YABuGb9jY34Rywk4H2wmhu'],
          },
          {
            childrenIds: [],
          },
        ],
      },
    },
  },
  block_VhteQbJa7bCSmykN4AcHkp: {
    type: 'Container',
    data: {
      style: {
        backgroundColor: null,
        borderColor: null,
        borderRadius: null,
        padding: {
          top: 0,
          bottom: 0,
          left: 0,
          right: 0,
        },
      },
      props: {
        childrenIds: [
          'block_2QEX1chf5uWU5ZZebf4gmu',
          'block_Lu666sTP6hqLkHiBThmm4G',
          'block_Gn2h8bajFuW8zDBsiVVitV',
          'block_2xkeWLDtTXj5jFg57KhfYR',
          'block_QgSNshqbsUkk4FrRywjoRd',
          'block_VvK99ZhLLgmycHQXKVFV7E',
        ],
      },
    },
  },

  block_WK3b19BzGE8VNKDwiSZ8s8: {
    type: 'ColumnsContainer',
    data: {
      style: {
        backgroundColor: null,
        padding: {
          top: 16,
          bottom: 16,
          left: 24,
          right: 24,
        },
      },
      props: {
        columnsCount: 2,
        columns: [
          {
            childrenIds: ['block_Wnt477QxYNynetWGwkLg89'],
          },
          {
            childrenIds: ['block_VhteQbJa7bCSmykN4AcHkp'],
          },
          {
            childrenIds: [],
          },
        ],
      },
    },
  },
  block_Pe2Dm5Cbqq5CcjL5wEdMg4: {
    type: 'NotionText',
    data: {
      style: {
        color: null,
        backgroundColor: null,
        fontFamily: null,
        fontWeight: 'normal',
        textAlign: 'left',
        padding: {
          top: 40,
          bottom: 24,
          left: 24,
          right: 24,
        },
      },
      props: {
        html: '<h3>Customer information</h3>',
      },
    },
  },
  block_2c68kHKvfEzD1DRVKqh4Pg: {
    type: 'NotionText',
    data: {
      style: {
        color: null,
        backgroundColor: null,
        fontSize: 16,
        fontFamily: null,
        fontWeight: 'bold',
        textAlign: 'left',
        padding: {
          top: 0,
          bottom: 8,
          left: 0,
          right: 0,
        },
      },
      props: {
        html: '<p>Shipping address</p>',
      },
    },
  },
  block_SY5nL8mzSPgeEyeDgkDUEa: {
    type: 'NotionText',
    data: {
      style: {
        color: null,
        backgroundColor: null,
        fontSize: 14,
        fontFamily: null,
        fontWeight: 'normal',
        textAlign: 'left',
        padding: {
          top: 0,
          bottom: 0,
          left: 0,
          right: 0,
        },
      },
      props: {
        html: '<p>123 Main St New York, NY 10002</p>',
      },
    },
  },
  block_ThQEcRPtSMqKiThzU9EGwV: {
    type: 'Container',
    data: {
      style: {
        backgroundColor: null,
        borderColor: null,
        borderRadius: null,
        padding: {
          top: 0,
          bottom: 0,
          left: 0,
          right: 0,
        },
      },
      props: {
        childrenIds: ['block_2c68kHKvfEzD1DRVKqh4Pg', 'block_SY5nL8mzSPgeEyeDgkDUEa'],
      },
    },
  },
  block_NkMSrWFvqewuenMYqLNcRa: {
    type: 'NotionText',
    data: {
      style: {
        color: null,
        backgroundColor: null,
        fontSize: 16,
        fontFamily: null,
        fontWeight: 'bold',
        textAlign: 'left',
        padding: {
          top: 0,
          bottom: 8,
          left: 0,
          right: 0,
        },
      },
      props: {
        html: '<p>Billing address</p>',
      },
    },
  },
  block_7RTvDRNCQpM5xV6oXsCx6s: {
    type: 'NotionText',
    data: {
      style: {
        color: null,
        backgroundColor: null,
        fontSize: 14,
        fontFamily: null,
        fontWeight: 'normal',
        textAlign: 'left',
        padding: {
          top: 0,
          bottom: 0,
          left: 0,
          right: 0,
        },
      },
      props: {
        html: '<p>123 Main St New York, NY 10002</p>',
      },
    },
  },
  block_KaHi1FBV64emMA3kb7x4vE: {
    type: 'Container',
    data: {
      style: {
        backgroundColor: null,
        borderColor: null,
        borderRadius: null,
        padding: {
          top: 0,
          bottom: 0,
          left: 0,
          right: 0,
        },
      },
      props: {
        childrenIds: ['block_NkMSrWFvqewuenMYqLNcRa', 'block_7RTvDRNCQpM5xV6oXsCx6s'],
      },
    },
  },
  block_SizNWJDCcqw9tGH2ComdDX: {
    type: 'ColumnsContainer',
    data: {
      style: {
        backgroundColor: null,
        padding: {
          top: 16,
          bottom: 16,
          left: 24,
          right: 24,
        },
      },
      props: {
        columnsCount: 2,
        columns: [
          {
            childrenIds: ['block_ThQEcRPtSMqKiThzU9EGwV'],
          },
          {
            childrenIds: ['block_KaHi1FBV64emMA3kb7x4vE'],
          },
          {
            childrenIds: [],
          },
        ],
      },
    },
  },
  block_4Qxv32WQo8pDzPu1d3vixz: {
    type: 'NotionText',
    data: {
      style: {
        color: null,
        backgroundColor: null,
        fontSize: 16,
        fontFamily: null,
        fontWeight: 'bold',
        textAlign: 'left',
        padding: {
          top: 24,
          bottom: 8,
          left: 24,
          right: 24,
        },
      },
      props: {
        html: '<p>Shipping method</p>',
      },
    },
  },
  block_LKiZYDTPeJGkRWHForFSDQ: {
    type: 'NotionText',
    data: {
      style: {
        color: null,
        backgroundColor: null,
        fontSize: 14,
        fontFamily: null,
        fontWeight: 'normal',
        textAlign: 'left',
        padding: {
          top: 0,
          bottom: 48,
          left: 24,
          right: 24,
        },
      },
      props: {
        html: '<p>Ground – Standard</p>',
      },
    },
  },
  block_P6XtJj721vPfrhXKzS8uR5: {
    type: 'Divider',
    data: {
      style: {
        backgroundColor: null,
        padding: {
          top: 16,
          bottom: 16,
          left: 0,
          right: 0,
        },
      },
      props: {
        lineHeight: 1,
        lineColor: '#EEEEEE',
      },
    },
  },
  block_AKTwpjBmtevcfj82z52i8p: {
    type: 'NotionText',
    data: {
      style: {
        color: null,
        backgroundColor: null,
        fontSize: 14,
        fontFamily: null,
        fontWeight: 'normal',
        textAlign: 'left',
        padding: {
          top: 16,
          bottom: 16,
          left: 24,
          right: 24,
        },
      },
      props: {
        html: '<p>If you have any questions, just reply to this email.</p>',
      },
    },
  },
};

export default ORDER_ECOMMERCE;
